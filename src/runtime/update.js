import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_AIHAUS_UPDATE_SOURCE = "git+https://github.com/overdrive-dev/aihaus-pi.git";

export function platformCommand(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

export function defaultPiCommand() {
  return process.env.AIHAUS_PI_COMMAND ?? platformCommand("pi");
}

export function defaultNpmCommand() {
  return process.env.AIHAUS_NPM_COMMAND ?? platformCommand("npm");
}

export function defaultGitCommand() {
  // Git for Windows is normally exposed as git.exe, not git.cmd. Keep
  // the literal command name so PATH resolution works across shells while
  // still allowing tests/operators to override it.
  return process.env.AIHAUS_GIT_COMMAND ?? "git";
}

export function splitShellArgs(input = "") {
  const args = [];
  let current = "";
  let quote = undefined;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "\\") {
      const canEscape = quote ? next === quote : next === "'" || next === '"' || /\s/.test(next ?? "");
      if (canEscape) {
        current += next;
        index += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) throw new Error(`unterminated ${quote} quote in update arguments`);
  if (current.length > 0) args.push(current);

  return args;
}

const UPDATE_CONTROL_FLAGS = new Set([
  "status",
  "--status",
  "--with-pi",
  "--aihaus-only",
  "--no-pi",
  "--pi-only",
  "--no-aihaus",
]);

export function parseAihausUpdateArgs(argv = [], { defaultIncludePi = true } = {}) {
  const flags = new Set(argv);
  const statusOnly = flags.has("status") || flags.has("--status");
  const piOnly = flags.has("--pi-only") || flags.has("--no-aihaus");
  const aihausOnly = flags.has("--aihaus-only") || flags.has("--no-pi");
  const withPi = flags.has("--with-pi");

  return {
    statusOnly,
    piOnly,
    aihausOnly,
    withPi,
    includePi: !statusOnly && !aihausOnly && (piOnly || withPi || defaultIncludePi),
    includeAihaus: !statusOnly && !piOnly,
    piArgs: argv.filter((arg) => !UPDATE_CONTROL_FLAGS.has(arg)),
  };
}

export function aihausUpdateHelp() {
  return [
    "Usage: aihaus update [options] [pi-update-args...]",
    "",
    "Shows aihaus-pi package status, updates the underlying Pi runtime when selected, and refreshes aihaus-pi when the install mode supports it.",
    "The aihaus launcher updates Pi by default. The /aih-update slash command skips the global Pi runtime update unless --with-pi is passed.",
    "Linked local checkouts are fast-forwarded with git when clean and preserved when dirty.",
    "",
    "Options:",
    "  status         show aihaus-pi/Pi update status only; run no update commands",
    "  --status       alias for status",
    "  --with-pi      also run `pi update` when the caller default skips Pi runtime updates",
    "  --pi-only      update Pi only; skip the aihaus-pi package refresh",
    "  --aihaus-only  refresh aihaus-pi only; skip `pi update`",
    "  --no-pi        alias for --aihaus-only",
    "  --no-aihaus    alias for --pi-only",
    "  -h, --help     show this help",
    "",
    "Any other arguments are passed to `pi update`.",
  ].join("\n");
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function runStep({ name, command, args, cwd, stdio = "pipe", log, spawn = spawnSync }) {
  log?.(`==> ${name}: ${commandText(command, args)}`);

  const result = spawn(command, args, {
    cwd,
    stdio: stdio === "inherit" ? "inherit" : "pipe",
    encoding: stdio === "inherit" ? undefined : "utf8",
    windowsHide: false,
    shell: process.platform === "win32",
  });

  const step = {
    name,
    command,
    args,
    status: result.status ?? (result.error ? 1 : 0),
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    error: result.error ? result.error.message : undefined,
  };

  if (result.error?.code === "ENOENT") {
    step.stderr = `${command} not found`;
  }

  return step;
}

function getAihausUpdateSource(packageJson) {
  return process.env.AIHAUS_UPDATE_SOURCE ?? packageJson.repository?.url ?? DEFAULT_AIHAUS_UPDATE_SOURCE;
}

function isPathInsidePiPackageStore(packageRoot) {
  const normalized = String(packageRoot ?? "").replaceAll("\\", "/").toLowerCase();
  return (
    normalized.includes("/.pi/git/") ||
    normalized.includes("/.pi/npm/") ||
    normalized.includes("/.pi/agent/git/") ||
    normalized.includes("/.pi/agent/npm/")
  );
}

function findGlobalPackage({ packageName, packageRoot, npmCommand, cwd, spawn = spawnSync }) {
  const rootStep = runStep({ name: "npm global root", command: npmCommand, args: ["root", "-g"], cwd, spawn });
  if (rootStep.status !== 0) {
    return {
      canUpdate: false,
      note: "npm global root could not be resolved.",
      diagnostics: rootStep,
    };
  }

  const globalRoot = rootStep.stdout.trim().split(/\r?\n/).at(-1)?.trim();
  if (!globalRoot) {
    return {
      canUpdate: false,
      note: "npm returned an empty global root.",
      diagnostics: rootStep,
    };
  }

  const installedPath = resolve(globalRoot, packageName);
  if (!existsSync(installedPath)) {
    return {
      canUpdate: false,
      note: `${packageName} is not installed in the global npm root.`,
      diagnostics: rootStep,
      globalRoot,
      installedPath,
    };
  }

  const stat = lstatSync(installedPath);
  if (stat.isSymbolicLink()) {
    return {
      canUpdate: false,
      linked: true,
      note: `${packageName} is linked to a local checkout at ${realpathSync(installedPath)}. It can be fast-forwarded with git when the checkout is clean.`,
      diagnostics: rootStep,
      globalRoot,
      installedPath,
    };
  }

  const installedRealPath = realpathSync(installedPath);
  const packageRealPath = realpathSync(packageRoot);
  if (installedRealPath !== packageRealPath) {
    return {
      canUpdate: false,
      note: `this launcher is running from ${packageRealPath}, not the global package at ${installedRealPath}.`,
      diagnostics: rootStep,
      globalRoot,
      installedPath,
      installedRealPath,
      packageRealPath,
    };
  }

  return { canUpdate: true, installedPath, globalRoot, diagnostics: rootStep };
}

export function inspectAihausPackage({ packageName, packageRoot, packageJson, npmCommand = defaultNpmCommand(), cwd = process.cwd(), spawn = spawnSync } = {}) {
  if (!packageRoot) throw new Error("inspectAihausPackage requires packageRoot");
  if (!packageJson?.name && !packageName) throw new Error("inspectAihausPackage requires package name");

  const name = packageName ?? packageJson.name;
  const updateSource = getAihausUpdateSource(packageJson ?? {});
  const piManaged = isPathInsidePiPackageStore(packageRoot);
  const globalPackage = findGlobalPackage({ packageName: name, packageRoot, npmCommand, cwd, spawn });

  let installMode = "non-global-package";
  let updateStrategy = "manual";
  let note = globalPackage.note;

  if (globalPackage.canUpdate) {
    installMode = "global-npm";
    updateStrategy = "npm-global-install";
    note = "aihaus-pi is running from the normal global npm installation.";
  } else if (globalPackage.linked) {
    installMode = "linked-global-checkout";
    updateStrategy = "linked-checkout-fast-forward";
  } else if (piManaged) {
    installMode = "pi-managed-package";
    updateStrategy = "pi-package-update";
    note = "aihaus-pi is running from Pi's package store; refresh package resources with `pi update --extensions`.";
  }

  return {
    packageName: name,
    currentVersion: packageJson?.version ?? "unknown",
    packageRoot,
    updateSource,
    installMode,
    updateStrategy,
    canRefreshWithNpm: updateStrategy === "npm-global-install",
    canRefreshWithPiPackageUpdate: updateStrategy === "pi-package-update",
    canRefreshLinkedCheckout: updateStrategy === "linked-checkout-fast-forward",
    note,
    globalPackage,
  };
}

export function runAihausUpdate({
  argv = [],
  cwd = process.cwd(),
  packageRoot,
  packageJson,
  piCommand = defaultPiCommand(),
  npmCommand = defaultNpmCommand(),
  stdio = "pipe",
  log,
  warn,
  defaultIncludePi = true,
  gitCommand = defaultGitCommand(),
  spawn = spawnSync,
} = {}) {
  if (!packageRoot) throw new Error("runAihausUpdate requires packageRoot");
  if (!packageJson?.name) throw new Error("runAihausUpdate requires packageJson.name");

  const parsed = parseAihausUpdateArgs(argv, { defaultIncludePi });
  const steps = [];
  const notes = [];
  const aihausStatus = inspectAihausPackage({ packageName: packageJson.name, packageRoot, packageJson, npmCommand, cwd, spawn });

  if (parsed.statusOnly) {
    notes.push("Status only: no update commands were run.");
  }

  if (parsed.includePi) {
    steps.push(
      runStep({
        name: "Pi runtime and package update",
        command: piCommand,
        args: ["update", ...parsed.piArgs],
        cwd,
        stdio,
        log,
        spawn,
      }),
    );
  } else if (!parsed.statusOnly) {
    notes.push(parsed.aihausOnly ? "Skipped Pi runtime update by request." : "Pi runtime update: not selected. Pass --with-pi to run `pi update` from /aih-update.");
  } else {
    notes.push("Pi runtime update: not selected for status-only mode.");
  }

  if (parsed.includeAihaus) {
    if (aihausStatus.updateStrategy === "npm-global-install") {
      steps.push(
        runStep({
          name: "aihaus-pi npm package refresh",
          command: npmCommand,
          args: ["install", "-g", aihausStatus.updateSource],
          cwd,
          stdio,
          log,
          spawn,
        }),
      );
    } else if (aihausStatus.updateStrategy === "linked-checkout-fast-forward") {
      const dirty = runStep({
        name: "aihaus-pi linked checkout dirty check",
        command: gitCommand,
        args: ["status", "--porcelain"],
        cwd: packageRoot,
        // Always capture stdout for the dirty check, even when the user-facing
        // update flow streams other commands to the terminal.
        stdio: "pipe",
        log,
        spawn,
      });
      if (dirty.status !== 0 || dirty.error) {
        steps.push(dirty);
      } else if (String(dirty.stdout ?? "").trim()) {
        notes.push(`Skipped aihaus-pi linked checkout fast-forward because ${packageRoot} has uncommitted changes.`);
      } else {
        const fetch = runStep({
          name: "aihaus-pi linked checkout fetch",
          command: gitCommand,
          args: ["fetch", "--tags", "--prune"],
          cwd: packageRoot,
          stdio,
          log,
          spawn,
        });
        steps.push(fetch);

        if (fetch.status === 0 && !fetch.error) {
          const fastForward = runStep({
            name: "aihaus-pi linked checkout fast-forward",
            command: gitCommand,
            args: ["pull", "--ff-only"],
            cwd: packageRoot,
            stdio,
            log,
            spawn,
          });
          steps.push(fastForward);

          if (fastForward.status === 0 && !fastForward.error) {
            steps.push(
              runStep({
                name: "aihaus-pi linked checkout dependency refresh",
                command: npmCommand,
                args: ["install", "--no-package-lock"],
                cwd: packageRoot,
                stdio,
                log,
                spawn,
              }),
            );
          }
        }
      }
    } else if (aihausStatus.updateStrategy === "pi-package-update") {
      steps.push(
        runStep({
          name: "aihaus-pi Pi package refresh",
          command: piCommand,
          args: ["update", "--extensions"],
          cwd,
          stdio,
          log,
          spawn,
        }),
      );
    } else {
      notes.push(`Skipped aihaus-pi package refresh: ${aihausStatus.note}`);
    }
  } else if (!parsed.statusOnly) {
    notes.push("Skipped aihaus-pi package refresh by request.");
  }

  for (const note of notes) warn?.(note);

  const failedSteps = steps.filter((step) => step.status !== 0 || step.error);
  return {
    ok: failedSteps.length === 0,
    steps,
    notes,
    failedSteps,
    piArgs: parsed.piArgs,
    includePi: parsed.includePi,
    includeAihaus: parsed.includeAihaus,
    statusOnly: parsed.statusOnly,
    aihausStatus,
  };
}

function trimOutput(text) {
  const normalized = String(text ?? "").trim();
  if (normalized.length <= 4000) return normalized;
  return `${normalized.slice(0, 4000)}\n...[truncated]`;
}

export function aihausStatusItems(status) {
  if (!status) return ["aihaus-pi status unavailable"];
  return [
    `current aihaus-pi version: ${status.currentVersion}`,
    `package root: ${status.packageRoot}`,
    `install mode: ${status.installMode}`,
    `update strategy: ${status.updateStrategy}`,
    `update source: ${status.updateSource}`,
    `status note: ${status.note ?? "none"}`,
  ];
}

export function updateResultItems(result) {
  const items = [];
  for (const step of result.steps) {
    const status = step.status === 0 && !step.error ? "ok" : `failed (${step.status})`;
    let item = `${step.name}: ${status}`;
    const output = trimOutput([step.stdout, step.stderr, step.error].filter(Boolean).join("\n"));
    if (output) item += `\n\n  Command: \`${commandText(step.command, step.args)}\`\n\n  Output:\n\n  \`\`\`text\n${output}\n  \`\`\``;
    items.push(item);
  }

  for (const note of result.notes) items.push(note);
  if (items.length === 0) items.push("No update steps were selected.");
  return items;
}

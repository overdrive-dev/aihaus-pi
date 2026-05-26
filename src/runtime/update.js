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

export function parseAihausUpdateArgs(argv = []) {
  const flags = new Set(argv);
  return {
    includePi: !flags.has("--aihaus-only") && !flags.has("--no-pi"),
    includeAihaus: !flags.has("--pi-only") && !flags.has("--no-aihaus"),
    piArgs: argv.filter(
      (arg) => !["--aihaus-only", "--no-pi", "--pi-only", "--no-aihaus"].includes(arg),
    ),
  };
}

export function aihausUpdateHelp() {
  return [
    "Usage: aihaus update [options] [pi-update-args...]",
    "",
    "Updates the underlying Pi runtime with `pi update`, then refreshes the global aihaus-pi package when it is installed as a normal npm global package.",
    "Linked local checkouts are preserved and reported instead of being overwritten.",
    "",
    "Options:",
    "  --pi-only       update Pi only; skip the aihaus-pi npm package refresh",
    "  --aihaus-only   refresh aihaus-pi only; skip `pi update`",
    "  --no-pi         alias for --aihaus-only",
    "  --no-aihaus     alias for --pi-only",
    "  -h, --help      show this help",
    "",
    "Any other arguments are passed to `pi update`.",
  ].join("\n");
}

function commandText(command, args) {
  return [command, ...args].join(" ");
}

function runStep({ name, command, args, cwd, stdio = "pipe", log }) {
  log?.(`==> ${name}: ${commandText(command, args)}`);

  const result = spawnSync(command, args, {
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

function findGlobalPackage({ packageName, packageRoot, npmCommand, cwd }) {
  const rootStep = runStep({ name: "npm global root", command: npmCommand, args: ["root", "-g"], cwd });
  if (rootStep.status !== 0) {
    return {
      canUpdate: false,
      note: "Skipped aihaus-pi package refresh because npm global root could not be resolved.",
      diagnostics: rootStep,
    };
  }

  const globalRoot = rootStep.stdout.trim().split(/\r?\n/).at(-1)?.trim();
  if (!globalRoot) {
    return {
      canUpdate: false,
      note: "Skipped aihaus-pi package refresh because npm returned an empty global root.",
      diagnostics: rootStep,
    };
  }

  const installedPath = resolve(globalRoot, packageName);
  if (!existsSync(installedPath)) {
    return {
      canUpdate: false,
      note: `Skipped aihaus-pi package refresh because ${packageName} is not installed in the global npm root.`,
      diagnostics: rootStep,
    };
  }

  const stat = lstatSync(installedPath);
  if (stat.isSymbolicLink()) {
    return {
      canUpdate: false,
      note: `Skipped aihaus-pi package refresh because ${packageName} is linked to a local checkout at ${realpathSync(installedPath)}. Pull that checkout instead of replacing the link.`,
      diagnostics: rootStep,
    };
  }

  const installedRealPath = realpathSync(installedPath);
  const packageRealPath = realpathSync(packageRoot);
  if (installedRealPath !== packageRealPath) {
    return {
      canUpdate: false,
      note: `Skipped aihaus-pi package refresh because this launcher is running from ${packageRealPath}, not the global package at ${installedRealPath}.`,
      diagnostics: rootStep,
    };
  }

  return { canUpdate: true, installedPath, diagnostics: rootStep };
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
} = {}) {
  if (!packageRoot) throw new Error("runAihausUpdate requires packageRoot");
  if (!packageJson?.name) throw new Error("runAihausUpdate requires packageJson.name");

  const parsed = parseAihausUpdateArgs(argv);
  const steps = [];
  const notes = [];

  if (parsed.includePi) {
    steps.push(
      runStep({
        name: "Pi runtime and package update",
        command: piCommand,
        args: ["update", ...parsed.piArgs],
        cwd,
        stdio,
        log,
      }),
    );
  } else {
    notes.push("Skipped Pi runtime update by request.");
  }

  if (parsed.includeAihaus) {
    const globalPackage = findGlobalPackage({ packageName: packageJson.name, packageRoot, npmCommand, cwd });
    if (!globalPackage.canUpdate) {
      notes.push(globalPackage.note);
      if (globalPackage.diagnostics?.status !== 0) steps.push(globalPackage.diagnostics);
    } else {
      const source = getAihausUpdateSource(packageJson);
      steps.push(
        runStep({
          name: "aihaus-pi npm package refresh",
          command: npmCommand,
          args: ["install", "-g", source],
          cwd,
          stdio,
          log,
        }),
      );
    }
  } else {
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
  };
}

function trimOutput(text) {
  const normalized = String(text ?? "").trim();
  if (normalized.length <= 4000) return normalized;
  return `${normalized.slice(0, 4000)}\n...[truncated]`;
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

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { WORKFLOW_STAGES } from "../workflow/stages.js";
import { DEFAULT_COHORTS } from "../models/cohorts.js";
import { GATEWAYS } from "../router/gateways.js";
import { aihausStatusItems, runAihausUpdate, splitShellArgs, updateResultItems } from "./update.js";
import { ensureProjectBaseline, projectPath, readJsonFile } from "../state/project.js";
import { collectTaskBlockers, readKanban, tasksByStage } from "../state/kanban.js";
import { addMcpPreset, commandForPlatform, listMcpServers, readMcpConfig, setMcpServerEnabled } from "../mcp/config.js";
import { inspectMcpServers, inspectPlaywrightProject } from "../mcp/doctor.js";
import { ensurePlaywrightConfig, PLAYWRIGHT_HEADLESS_ENV, PLAYWRIGHT_MCP_SERVER_NAME, playwrightInstallPlan } from "../mcp/presets/playwright.js";
import {
  advanceExecutionCursor,
  buildSlicedPrompt,
  clearExecutionState,
  createExecutionPlan,
  getActiveSlice,
  readExecutionState,
} from "../execution/slices.js";

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(runtimeDir, "..", "..");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

function ok(text) {
  return `OK ${text}`;
}

function warn(text) {
  return `WARN ${text}`;
}

function error(text) {
  return `ERROR ${text}`;
}

function levelFromItems(items) {
  if (items.some((item) => item.startsWith("ERROR"))) return "error";
  if (items.some((item) => item.startsWith("WARN"))) return "warning";
  return "success";
}

function commandText(command, args) {
  return [command, ...(args ?? [])].join(" ");
}

function runCommand(command, args, cwd) {
  return spawnSync(commandForPlatform(command), args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: 120_000,
  });
}

function hasFile(cwd, rel) {
  return existsSync(join(cwd, rel));
}

function checkJsonFile(cwd, rel, label = rel) {
  const path = join(cwd, rel);
  if (!existsSync(path)) return error(`missing ${rel}`);
  try {
    JSON.parse(readFileSync(path, "utf8"));
    return ok(`${label} readable`);
  } catch (err) {
    return error(`${rel} is not valid JSON: ${err.message}`);
  }
}

function checkOllama(cwd) {
  const version = runCommand("ollama", ["--version"], cwd);
  if (version.status !== 0) return warn("Ollama not reachable; vector memory will run in degraded mode");

  const list = runCommand("ollama", ["list"], cwd);
  if (list.status !== 0) return warn("Ollama is installed but model list failed");
  if (!String(list.stdout ?? "").includes("nomic-embed-text")) {
    return warn("Ollama is installed but nomic-embed-text is missing; run `ollama pull nomic-embed-text`");
  }
  return ok("Ollama and nomic-embed-text available");
}

function checkModelCohorts(cwd) {
  const rel = "aihaus-pi/state/model-cohorts.json";
  const path = join(cwd, rel);
  if (!existsSync(path)) return error(`missing ${rel}`);
  try {
    const config = JSON.parse(readFileSync(path, "utf8"));
    const missing = Object.entries(config.cohorts ?? {}).filter(([, value]) => !value.provider || !value.model);
    if (missing.length > 0) return warn(`model cohorts present but ${missing.length} cohort(s) still need provider/model mapping`);
    return ok("model cohorts configured");
  } catch (err) {
    return error(`${rel} is not valid JSON: ${err.message}`);
  }
}

export async function buildInitPlan({ cwd }) {
  const baseline = await ensureProjectBaseline({ cwd });
  return {
    title: "aih-init report",
    level: "success",
    summary: "Project baseline is ready for business-rule-first aihaus-pi work.",
    sections: [
      {
        title: "Baseline files",
        items: [
          ...baseline.created.map((rel) => `created ${rel}`),
          ...baseline.existing.map((rel) => `preserved ${rel}`),
        ],
      },
      {
        title: "Repository discovery",
        items: [
          `working directory: ${cwd}`,
          "baseline discovery remains read-only for customer product code",
          "facts must be labeled as docs/code/tests/git/user-answer/hypothesis/unknown before execution",
        ],
      },
      {
        title: "Business-rule onboarding",
        items: [
          "ask Socratic questions only for facts that cannot be inferred confidently",
          "write BDD scenarios before tasks can move into development",
          "UI and user-flow validation requires Playwright evidence when applicable",
        ],
      },
      {
        title: "Model cohorts",
        items: [
          `seeded default cohorts when missing: ${DEFAULT_COHORTS.map((c) => c.name).join(", ")}`,
          "map provider/model/thinking/fallback per cohort before high-autonomy execution",
        ],
      },
    ],
  };
}

export async function buildDoctorReport({ cwd } = {}) {
  const checks = [
    checkJsonFile(cwd, "aihaus-pi/config.json", "project config"),
    checkJsonFile(cwd, "aihaus-pi/state/kanban.json", "kanban"),
    checkJsonFile(cwd, "aihaus-pi/mcp.json", "MCP config"),
    checkJsonFile(cwd, "aihaus-pi/state/memory-index.json", "memory index"),
    checkModelCohorts(cwd),
    hasFile(cwd, "aihaus-pi/rules/domain.md") ? ok("markdown rule book present") : warn("missing aihaus-pi/rules/domain.md"),
    checkOllama(cwd),
  ];

  for (const result of inspectMcpServers(cwd)) {
    checks.push(result.status === "ok" ? ok(`MCP ${result.name}: ${result.message}`) : result.status === "warn" ? warn(`MCP ${result.name}: ${result.message}`) : error(`MCP ${result.name}: ${result.message}`));
  }

  let mcp = { servers: {} };
  try {
    mcp = readJsonFile(projectPath(cwd, "mcp.json"), { servers: {} });
  } catch {
    mcp = { servers: {} };
  }
  if (mcp.servers?.playwright?.enabled) {
    const pw = inspectPlaywrightProject(cwd);
    checks.push(pw.status === "ok" ? ok(`Playwright: ${pw.message}`) : pw.status === "warn" ? warn(`Playwright: ${pw.message}`) : error(`Playwright: ${pw.message}`));
  }

  return {
    title: "aih-doctor report",
    level: levelFromItems(checks),
    summary: "Read-only harness health check. Errors block autonomous execution; warnings require explicit risk acceptance or follow-up.",
    sections: [
      {
        title: "Checks",
        items: checks,
      },
    ],
  };
}

function parseMcpArgs(args = "") {
  const argv = splitShellArgs(args);
  return {
    action: argv[0] ?? "help",
    name: argv[1],
    yes: argv.includes("--yes") || argv.includes("-y"),
    pin: argv.find((arg) => arg.startsWith("--pin="))?.slice("--pin=".length),
    argv,
  };
}

export async function buildMcpReport({ cwd, args = "" } = {}) {
  let parsed;
  try {
    parsed = parseMcpArgs(args);
  } catch (err) {
    return { title: "aih-mcp failed", level: "error", summary: err.message, sections: [] };
  }

  if (["help", "--help", "-h"].includes(parsed.action)) {
    return {
      title: "aih-mcp help",
      summary: "Manage aihaus-pi MCP tool providers. Installs are confirmation-gated.",
      sections: [
        {
          title: "Commands",
          items: [
            "/aih-mcp list",
            "/aih-mcp doctor",
            "/aih-mcp add playwright [--pin=<version>]",
            "/aih-mcp install playwright --yes",
            "/aih-mcp enable playwright",
            "/aih-mcp disable playwright",
          ],
        },
      ],
    };
  }

  if (parsed.action === "list") {
    const servers = listMcpServers(cwd);
    return {
      title: "aih-mcp list",
      level: servers.length > 0 ? "success" : "warning",
      summary: servers.length > 0 ? "Configured MCP servers." : "No MCP servers configured.",
      sections: [
        {
          title: "Servers",
          items: servers.length > 0 ? servers.map((server) => `${server.name}: ${server.enabled === false ? "disabled" : "enabled"} ${server.type ?? "unknown"} ${server.command ?? ""} ${(server.args ?? []).join(" ")}`) : ["Run `/aih-mcp add playwright` to add the official Playwright preset."],
        },
      ],
    };
  }

  if (parsed.action === "doctor") {
    const checks = inspectMcpServers(cwd).map((result) =>
      result.status === "ok" ? ok(`${result.name}: ${result.message}`) : result.status === "warn" ? warn(`${result.name}: ${result.message}`) : error(`${result.name}: ${result.message}`),
    );
    return {
      title: "aih-mcp doctor",
      level: levelFromItems(checks),
      summary: "Read-only MCP provider check.",
      sections: [{ title: "MCP checks", items: checks }],
    };
  }

  if (parsed.action === "add") {
    if (parsed.name !== PLAYWRIGHT_MCP_SERVER_NAME) {
      return { title: "aih-mcp failed", level: "error", summary: `Unknown MCP preset: ${parsed.name ?? "<missing>"}`, sections: [] };
    }
    const result = addMcpPreset(cwd, parsed.name, { packageVersion: parsed.pin ?? "latest" });
    return {
      title: "aih-mcp add playwright",
      level: "success",
      summary: result.existed ? "Playwright MCP preset already existed and is enabled." : "Playwright MCP preset added and enabled.",
      sections: [
        {
          title: "Server",
          items: [
            `playwright: ${result.server.command} ${result.server.args.join(" ")}`,
            `browser default: ${result.server.browser?.defaultMode ?? "headed"}, slowMo ${result.server.browser?.slowMo ?? 0}; headless is opt-in with ${result.server.browser?.headlessOptInArg ?? "--headless"}`,
            `required for: ${result.server.requiredFor.join(", ")}`,
          ],
        },
        {
          title: "Next step",
          items: ["Run `/aih-mcp install playwright --yes` when you want aihaus-pi to install @playwright/test and browser binaries in this project."],
        },
      ],
    };
  }

  if (["enable", "disable"].includes(parsed.action)) {
    if (!parsed.name) return { title: "aih-mcp failed", level: "error", summary: `Missing MCP server name for ${parsed.action}.`, sections: [] };
    const server = setMcpServerEnabled(cwd, parsed.name, parsed.action === "enable");
    return {
      title: `aih-mcp ${parsed.action} ${parsed.name}`,
      level: "success",
      summary: `${parsed.name} is now ${server.enabled ? "enabled" : "disabled"}.`,
      sections: [{ title: "Server", items: [`${parsed.name}: ${server.enabled ? "enabled" : "disabled"}`] }],
    };
  }

  if (parsed.action === "install") {
    if (parsed.name !== PLAYWRIGHT_MCP_SERVER_NAME) {
      return { title: "aih-mcp failed", level: "error", summary: `Unknown install target: ${parsed.name ?? "<missing>"}`, sections: [] };
    }

    const plan = playwrightInstallPlan();
    const configPlan = `playwright.config.ts — create only when no Playwright config exists; headed default, no slowMo, headless opt-in with ${PLAYWRIGHT_HEADLESS_ENV}=1.`;
    if (!parsed.yes) {
      return {
        title: "aih-mcp install playwright",
        level: "warning",
        summary: "Installing MCP/test dependencies mutates the project and requires explicit confirmation. Re-run with `--yes` to execute.",
        sections: [
          {
            title: "Commands not run",
            items: plan.map((step) => `${commandText(step.command, step.args)} — ${step.reason}`),
          },
          {
            title: "Config not written",
            items: [configPlan],
          },
        ],
      };
    }

    const results = plan.map((step) => {
      const result = runCommand(step.command, step.args, cwd);
      return {
        step,
        status: result.status ?? 1,
        output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
      };
    });
    const installOk = results.every((result) => result.status === 0);
    const configResult = installOk
      ? ensurePlaywrightConfig({ cwd })
      : { status: "skipped", message: "Skipped playwright.config.ts because one or more install commands failed." };
    const items = results.map((result) => `${commandText(result.step.command, result.step.args)}: ${result.status === 0 ? "ok" : `failed (${result.status})`}${result.output ? `\n\n  \`\`\`text\n${result.output.slice(0, 2000)}\n  \`\`\`` : ""}`);
    return {
      title: "aih-mcp install playwright",
      level: installOk ? "success" : "error",
      summary: "Playwright install commands executed by explicit confirmation.",
      sections: [
        { title: "Install result", items },
        { title: "Playwright config", items: [`${configResult.status}: ${configResult.message}`] },
      ],
    };
  }

  return { title: "aih-mcp failed", level: "error", summary: `Unknown MCP action: ${parsed.action}`, sections: [] };
}

export async function buildExecutionReport({ cwd, args = "" } = {}) {
  const raw = String(args ?? "").trim();
  const [action = "status"] = splitShellArgs(raw || "status");

  if (["help", "--help", "-h"].includes(action)) {
    return {
      title: "aih-exec help",
      summary: "Manage long-running aihaus-pi execution cursors so large requests run slice-by-slice instead of overflowing context.",
      sections: [
        {
          title: "Commands",
          items: [
            "/aih-exec plan <large request>",
            "/aih-exec status",
            "/aih-exec next",
            "/aih-exec clear",
          ],
        },
      ],
    };
  }

  if (action === "plan") {
    const request = raw.slice("plan".length).trim();
    if (!request) {
      return { title: "aih-exec failed", level: "error", summary: "Missing request text after `plan`.", sections: [] };
    }
    const state = await createExecutionPlan({ cwd, request, reason: "explicit-aih-exec-plan" });
    const active = getActiveSlice(state);
    return {
      title: "aih-exec plan",
      level: "success",
      summary: `Execution plan created with ${state.slices.length} slice${state.slices.length === 1 ? "" : "s"}.`,
      sections: [
        {
          title: "Active slice",
          items: [active ? `${active.id}: ${active.title}` : "none"],
        },
        {
          title: "State files",
          items: ["aihaus-pi/state/execution.json", "aihaus-pi/continue.md"],
        },
      ],
    };
  }

  if (action === "next") {
    try {
      const state = await advanceExecutionCursor({ cwd });
      const active = getActiveSlice(state);
      return {
        title: "aih-exec next",
        level: state.status === "done" ? "success" : "success",
        summary: state.status === "done" ? "Execution plan completed." : `Advanced to ${active.id}: ${active.title}`,
        sections: [
          {
            title: "Cursor",
            items: [state.status === "done" ? "all slices done" : buildSlicedPrompt(state)],
          },
        ],
      };
    } catch (err) {
      return { title: "aih-exec failed", level: "error", summary: err.message, sections: [] };
    }
  }

  if (action === "clear" || action === "reset") {
    clearExecutionState(cwd);
    return {
      title: "aih-exec clear",
      level: "success",
      summary: "Execution cursor cleared.",
      sections: [{ title: "State", items: ["aihaus-pi/state/execution.json marked cleared"] }],
    };
  }

  if (action !== "status") {
    return { title: "aih-exec failed", level: "error", summary: `Unknown execution action: ${action}`, sections: [] };
  }

  const state = readExecutionState(cwd);
  if (!state || state.status === "cleared") {
    return {
      title: "aih-exec status",
      level: "warning",
      summary: "No active execution cursor.",
      sections: [{ title: "Next step", items: ["Run `/aih-exec plan <large request>` or send a large multi-task prompt to create one automatically."] }],
    };
  }

  const active = getActiveSlice(state);
  return {
    title: "aih-exec status",
    level: state.status === "done" ? "success" : "warning",
    summary: state.status === "done" ? "Execution plan is complete." : "Execution plan is active. Execute only the active slice.",
    sections: [
      {
        title: "Cursor",
        items: [
          active ? `${active.id}: ${active.title}` : "none",
          `progress: ${(state.cursor?.completed ?? []).length}/${state.slices?.length ?? 0}`,
        ],
      },
      {
        title: "Slices",
        items: (state.slices ?? []).map((slice) => `${slice.id}: ${slice.status} — ${slice.title}`),
      },
    ],
  };
}

export async function buildUpdatePlan({ cwd, args = "" } = {}) {
  let argv;
  try {
    argv = splitShellArgs(args);
  } catch (error_) {
    return {
      title: "aih-update failed",
      level: "error",
      summary: error_.message,
      sections: [],
    };
  }

  const result = runAihausUpdate({ cwd, argv, packageRoot, packageJson, defaultIncludePi: false });

  return {
    title: result.ok ? "aih-update report" : "aih-update failed",
    level: result.ok ? "success" : "error",
    summary: result.ok
      ? "Update flow completed. Restart aihaus so the next session loads the refreshed runtime."
      : "Update flow completed with blockers. This command does not repair corrupted local state; use /aih-repair for repair work.",
    sections: [
      {
        title: "aihaus-pi status",
        items: aihausStatusItems(result.aihausStatus),
      },
      {
        title: "Update scope",
        items: [
          "slash /aih-update refreshes aihaus-pi package resources by default and reports aihaus-pi status first",
          "Pi runtime update is not selected by default from the target repository; pass `--with-pi` to run `pi update`",
          "normal global npm installs refresh with `npm install -g <source>`",
          "Pi-managed package installs refresh with `pi update --extensions`",
          "fast-forwarded linked local checkouts through git when clean, or preserved them when dirty",
          "preserved rules, kanban, memory, docs, and evidence",
        ],
      },
      {
        title: "Result",
        items: updateResultItems(result),
      },
    ],
  };
}

export async function buildRepairPlan() {
  return {
    title: "aih-repair plan",
    summary: "Repair harness state without changing aihaus-pi version.",
    sections: [
      {
        title: "Repair scope",
        items: [
          "recreate missing harness markdown from templates without overwriting customer-authored sections",
          "repair SQLite schema and kanban consistency",
          "rebuild vector-memory index metadata",
          "recover interrupted sessions and blockers when possible",
          "relink Pi package resources when broken",
          "never edit customer product code without explicit confirmation",
        ],
      },
    ],
  };
}

export async function buildCleanupPlan() {
  return {
    title: "aih-cleanup plan",
    summary: "Clean safe harness leftovers with dry-run-first behavior.",
    sections: [
      {
        title: "Cleanup scope",
        items: [
          "classify harness worktrees as safe, review, blocked, or error",
          "remove stale locks only when owner process/session is gone",
          "compact logs and remove caches under harness-owned directories",
          "preserve dirty worktrees and customer files",
          "never run broad git clean",
        ],
      },
    ],
  };
}

export async function buildStatusReport({ cwd } = {}) {
  if (!hasFile(cwd, "aihaus-pi/state/kanban.json")) {
    return {
      title: "aih-status report",
      level: "warning",
      summary: "Internal kanban not found. Run `/aih-init` to create the project baseline.",
      sections: [
        {
          title: "Workflow",
          items: WORKFLOW_STAGES.map((stage) => `${stage.name}: ${stage.purpose}`),
        },
      ],
    };
  }

  const kanban = readKanban(cwd);
  const grouped = tasksByStage(kanban);
  const blockers = collectTaskBlockers(kanban);
  let mcp = { servers: {} };
  try {
    mcp = readMcpConfig(cwd);
  } catch {
    mcp = { servers: {} };
  }
  const serverNames = Object.entries(mcp.servers ?? {}).map(([name, server]) => `${name}: ${server.enabled === false ? "disabled" : "enabled"}`);
  const executionState = readExecutionState(cwd);
  const activeSlice = getActiveSlice(executionState);

  return {
    title: "aih-status report",
    level: blockers.length > 0 ? "warning" : "success",
    summary: "Internal kanban is the source of truth; Linear is only a sync interface.",
    sections: [
      {
        title: "Workflow",
        items: Array.from(grouped.entries()).map(([stage, tasks]) => `${stage}: ${tasks.length} task${tasks.length === 1 ? "" : "s"}`),
      },
      {
        title: "Tasks",
        items: (kanban.tasks ?? []).length > 0 ? (kanban.tasks ?? []).map((task) => `${task.id ?? "no-id"}: ${task.title ?? "untitled"} [${task.stage ?? "Backlog"}]`) : ["No tasks captured yet."],
      },
      {
        title: "Blockers",
        items: blockers.length > 0 ? blockers.map((blocker) => (typeof blocker === "string" ? blocker : `${blocker.taskId ?? "project"}: ${blocker.text}`)) : ["No blockers recorded."],
      },
      {
        title: "Execution cursor",
        items: activeSlice
          ? [`${activeSlice.id}: ${activeSlice.title}`, `progress: ${(executionState.cursor?.completed ?? []).length}/${executionState.slices?.length ?? 0}`, "Use /aih-exec next only after evidence for the active slice."]
          : ["No active execution cursor."],
      },
      {
        title: "MCP providers",
        items: serverNames.length > 0 ? serverNames : ["No MCP providers configured."],
      },
      {
        title: "Skill gateways",
        items: GATEWAYS.map((gateway) => `${gateway.name}: ${gateway.when}`),
      },
    ],
  };
}

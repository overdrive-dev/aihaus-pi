import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routeIntent } from "../router/gateways.js";
import { CONTEXT_PACK_INJECTION } from "../agents/context.js";
import { readKanban, activeTasks, collectTaskBlockers } from "../state/kanban.js";
import { projectPath, readJsonFile } from "../state/project.js";
import { readMcpConfig } from "../mcp/config.js";

const UI_TERMS = ["ui", "tela", "frontend", "visual", "browser", "fluxo", "user-flow", "playwright", "screenshot"];

function isUiPrompt(prompt) {
  const lower = String(prompt ?? "").toLowerCase();
  return UI_TERMS.some((term) => lower.includes(term));
}

function readMarkdownFiles(dir, { maxFiles = 6, maxChars = 1200 } = {}) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isFile() && name.name.endsWith(".md")) files.push(join(dir, name.name));
  }
  return files.slice(0, maxFiles).map((path) => ({
    path,
    content: readFileSync(path, "utf8").slice(0, maxChars),
  }));
}

function formatJsonSummary(value) {
  return JSON.stringify(value ?? {}, null, 2).slice(0, 1600);
}

function section(title, lines) {
  const body = lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "- none";
  return `## ${title}\n${body}`;
}

export async function buildContextPack({ cwd, prompt = "" } = {}) {
  const gateway = routeIntent(prompt);
  const kanban = readKanban(cwd);
  const tasks = activeTasks(kanban);
  const blockers = collectTaskBlockers(kanban);
  const rules = readMarkdownFiles(projectPath(cwd, "rules"));
  const memoryIndex = readJsonFile(projectPath(cwd, "state", "memory-index.json"), undefined);
  let mcp = { servers: {} };
  let mcpError;
  try {
    mcp = readMcpConfig(cwd);
  } catch (error) {
    mcpError = error.message;
  }
  const enabledMcp = Object.entries(mcp.servers ?? {}).filter(([, server]) => server.enabled !== false);
  const uiEvidenceRequired = isUiPrompt(prompt) || enabledMcp.some(([name]) => name === "playwright");

  const content = [
    "# aihaus-pi context pack",
    "",
    `Gateway: ${gateway}`,
    `Prompt fact source: explicit user input for this turn`,
    `Context status: ${existsSync(projectPath(cwd)) ? "baseline-present" : "baseline-missing"}`,
    "",
    section(
      "Kanban facts",
      tasks.map((task) => `${task.id ?? "no-id"}: ${task.title ?? "untitled"} [${task.stage ?? "Backlog"}]`),
    ),
    "",
    section(
      "Blockers and pending questions",
      blockers.map((blocker) =>
        typeof blocker === "string" ? blocker : `${blocker.taskId ?? "project"}: ${blocker.text ?? JSON.stringify(blocker)}`,
      ),
    ),
    "",
    section(
      "Rule/doc facts",
      rules.map((rule) => `${rule.path.replace(cwd, ".")}\n\n${rule.content.trim()}`),
    ),
    "",
    section(
      "MCP tool providers",
      mcpError
        ? [`invalid MCP config: ${mcpError}`]
        : enabledMcp.map(([name, server]) => `${name}: ${server.type ?? "unknown"} ${server.command ?? ""} ${(server.args ?? []).join(" ")}`),
    ),
    "",
    section(
      "Evidence required",
      [
        "Automated tests/checks appropriate to the change before closure.",
        uiEvidenceRequired
          ? "Playwright screenshot/trace/browser evidence is required for UI or user-flow validation."
          : "Playwright evidence not inferred from this prompt; reassess if UI/user-flow impact appears.",
        "Human review remains a separate mandatory gate.",
      ],
    ),
    "",
    section(
      "Memory index",
      memoryIndex ? [`${memoryIndex.embedding?.provider ?? "unknown"}/${memoryIndex.embedding?.model ?? "unknown"}: ${memoryIndex.embedding?.status ?? "unknown"}`] : ["missing aihaus-pi/state/memory-index.json"],
    ),
    "",
    "## Raw context snapshot",
    "```json",
    formatJsonSummary({ gateway, activeTaskCount: tasks.length, mcpServers: Object.keys(mcp.servers ?? {}) }),
    "```",
  ].join("\n");

  return {
    customType: CONTEXT_PACK_INJECTION.customType,
    content,
    display: false,
    details: {
      gateway,
      activeTaskCount: tasks.length,
      mcpServers: Object.keys(mcp.servers ?? {}),
      uiEvidenceRequired,
    },
  };
}

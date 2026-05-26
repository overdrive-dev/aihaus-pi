import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { routeIntent } from "../router/gateways.js";
import { CONTEXT_PACK_INJECTION } from "../agents/context.js";
import { readKanban, activeTasks, collectTaskBlockers } from "../state/kanban.js";
import { projectPath, readJsonFile } from "../state/project.js";
import { readMcpConfig } from "../mcp/config.js";
import { getActiveSlice, readExecutionState } from "../execution/slices.js";

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

function enforceContextBudget(content, maxChars) {
  const budget = {
    maxChars,
    originalChars: content.length,
    finalChars: content.length,
    truncated: false,
  };

  if (!maxChars || content.length <= maxChars) return { content, budget };

  const suffix = [
    "",
    "## Context budget",
    `- truncated: true`,
    `- originalChars: ${content.length}`,
    `- maxChars: ${maxChars}`,
    "- policy: active slice, blockers, and evidence requirements are preserved first; overflow details stay in aihaus-pi state files.",
  ].join("\n");
  const headSize = Math.max(0, maxChars - suffix.length - 1);
  const next = `${content.slice(0, headSize).trimEnd()}\n${suffix}`;
  budget.finalChars = next.length;
  budget.truncated = true;
  return { content: next.slice(0, maxChars), budget: { ...budget, finalChars: Math.min(next.length, maxChars) } };
}

export async function buildContextPack({ cwd, prompt = "", maxChars = 12_000 } = {}) {
  const gateway = routeIntent(prompt);
  const kanban = readKanban(cwd);
  const tasks = activeTasks(kanban);
  const blockers = collectTaskBlockers(kanban);
  const rules = readMarkdownFiles(projectPath(cwd, "rules"));
  const executionState = readExecutionState(cwd);
  const activeSlice = getActiveSlice(executionState);
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

  const rawContent = [
    "# aihaus-pi context pack",
    "",
    `Gateway: ${gateway}`,
    `Prompt fact source: explicit user input for this turn`,
    `Context status: ${existsSync(projectPath(cwd)) ? "baseline-present" : "baseline-missing"}`,
    "",
    section(
      "Execution cursor",
      activeSlice
        ? [
            `Active slice: ${activeSlice.id} - ${activeSlice.title}`,
            `Cursor: ${(executionState.cursor?.activeIndex ?? 0) + 1}/${executionState.slices?.length ?? 1}`,
            "Policy: execute only the active slice; do not claim the full request is complete.",
          ]
        : ["no active execution cursor"],
    ),
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

  const { content, budget } = enforceContextBudget(rawContent, maxChars);

  return {
    customType: CONTEXT_PACK_INJECTION.customType,
    content,
    display: false,
    details: {
      gateway,
      activeTaskCount: tasks.length,
      mcpServers: Object.keys(mcp.servers ?? {}),
      uiEvidenceRequired,
      execution: activeSlice ? { activeSliceId: activeSlice.id, activeIndex: executionState.cursor?.activeIndex ?? 0, totalSlices: executionState.slices?.length ?? 0 } : undefined,
      budget,
    },
  };
}

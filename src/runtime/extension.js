import {
  buildDoctorReport,
  buildInitPlan,
  buildRepairPlan,
  buildUpdatePlan,
  buildCleanupPlan,
  buildStatusReport,
  buildMcpReport,
  buildExecutionReport,
} from "./plans.js";
import { buildContextPack } from "../context/pack.js";
import { registerConfiguredMcpTools } from "../mcp/bridge.js";
import { buildSlicedPrompt, createExecutionPlan, shouldSliceInput } from "../execution/slices.js";

const COMMANDS = [
  ["aih-init", "Discover or bootstrap the project, configure model cohorts, and create the memory baseline.", buildInitPlan],
  ["aih-doctor", "Run a read-only aihaus-pi health check.", buildDoctorReport],
  ["aih-update", "Update the aihaus-pi package version and apply version migrations.", buildUpdatePlan],
  ["aih-repair", "Repair harness state without updating aihaus-pi.", buildRepairPlan],
  ["aih-cleanup", "Clean safe harness leftovers, stale locks, worktrees, and caches.", buildCleanupPlan],
  ["aih-status", "Show internal kanban tasks, blockers, and next questions.", buildStatusReport],
  ["aih-mcp", "Manage aihaus-pi MCP tool providers such as Playwright.", buildMcpReport],
  ["aih-exec", "Manage long-running execution cursors for large multi-task requests.", buildExecutionReport],
];

function notifyLevel(level) {
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  return "info";
}

export async function createAihausPiExtension(pi) {
  for (const [name, description, handler] of COMMANDS) {
    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        const cwd = ctx?.cwd ?? process.cwd();
        const report = await handler({ cwd, args: String(args ?? "").trim() });
        const markdown = reportToMarkdown(report);
        ctx?.ui?.notify?.(report.title, notifyLevel(report.level));
        pi.sendMessage?.(
          {
            customType: "aihaus-pi.report",
            content: markdown,
            display: true,
            details: { command: name, level: report.level ?? "info" },
          },
          { triggerTurn: false },
        );
      },
    });
  }

  pi.on?.("session_start", async (_event, ctx) => {
    await registerConfiguredMcpTools(pi, ctx);
  });

  pi.on?.("input", async (event, ctx) => {
    const text = String(event?.text ?? "");
    if (event?.source === "extension") return { action: "continue" };
    if (text.startsWith("/")) return { action: "continue" };
    if (!shouldSliceInput(text)) return { action: "continue" };

    const state = await createExecutionPlan({
      cwd: ctx?.cwd ?? process.cwd(),
      request: text,
      reason: text.length > 8000 ? "prompt-length-budget" : "multi-task-budget",
    });
    ctx?.ui?.notify?.(`aihaus-pi split this request into ${state.slices.length} slices`, "warning");
    return {
      action: "transform",
      text: buildSlicedPrompt(state),
    };
  });

  pi.on?.("before_agent_start", async (event, ctx) => {
    const contextPack = await buildContextPack({ cwd: ctx?.cwd ?? process.cwd(), prompt: event.prompt ?? "" });
    return {
      message: contextPack,
      systemPrompt: [
        event.systemPrompt ?? "",
        "aihaus-pi operating rule: consult persisted project rules, kanban, markdown memory, and vector memory before treating any claim as true. Use business-rule-first language by default. Treat missing context as a blocker, not as permission to guess.",
      ].filter(Boolean).join("\n\n"),
    };
  });
}

export function reportToMarkdown(report) {
  const lines = [`# ${report.title}`, ""];
  if (report.summary) lines.push(report.summary, "");
  for (const section of report.sections ?? []) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

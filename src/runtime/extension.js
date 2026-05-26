import {
  buildDoctorReport,
  buildInitPlan,
  buildRepairPlan,
  buildUpdatePlan,
  buildCleanupPlan,
  buildStatusReport,
} from "./plans.js";

const COMMANDS = [
  ["aih-init", "Discover or bootstrap the project, configure model cohorts, and create the memory baseline.", buildInitPlan],
  ["aih-doctor", "Run a read-only aihaus-pi health check.", buildDoctorReport],
  ["aih-update", "Update the aihaus-pi package version and apply version migrations.", buildUpdatePlan],
  ["aih-repair", "Repair harness state without updating aihaus-pi.", buildRepairPlan],
  ["aih-cleanup", "Clean safe harness leftovers, stale locks, worktrees, and caches.", buildCleanupPlan],
  ["aih-status", "Show internal kanban tasks, blockers, and next questions.", buildStatusReport],
];

export function createAihausPiExtension(pi) {
  for (const [name, description, handler] of COMMANDS) {
    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        const cwd = ctx?.cwd ?? process.cwd();
        const report = await handler({ cwd, args: String(args ?? "").trim() });
        ctx?.ui?.notify?.(report.title, report.level ?? "info");
        return {
          action: "handled",
          content: reportToMarkdown(report),
        };
      },
    });
  }

  pi.on?.("input", async (event) => {
    const text = String(event?.text ?? "");
    if (text.startsWith("/aih-")) return { action: "continue" };
    return { action: "continue" };
  });

  pi.on?.("before_agent_start", async (event) => {
    return {
      systemPrompt: [
        event.systemPrompt ?? "",
        "aihaus-pi operating rule: consult persisted project rules, kanban, markdown memory, and vector memory before treating any claim as true. Use business-rule-first language by default.",
      ].filter(Boolean).join("\n\n"),
    };
  });
}

function reportToMarkdown(report) {
  const lines = [`# ${report.title}`, ""];
  if (report.summary) lines.push(report.summary, "");
  for (const section of report.sections ?? []) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items) lines.push(`- ${item}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

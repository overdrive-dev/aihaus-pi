import { WORKFLOW_STAGES } from "../workflow/stages.js";
import { DEFAULT_COHORTS } from "../models/cohorts.js";
import { GATEWAYS } from "../router/gateways.js";

export async function buildInitPlan({ cwd }) {
  return {
    title: "aih-init plan",
    summary: "Bootstrap or refresh aihaus-pi project context before any autonomous execution.",
    sections: [
      {
        title: "Repository discovery",
        items: [
          `working directory: ${cwd}`,
          "detect whether the repo is empty, legacy, partially documented, or already initialized",
          "scan docs, code, tests, package manifests, git history, and existing rules read-only",
          "mark every fact as inferred from docs, code, tests, git history, user answer, hypothesis, or unknown",
        ],
      },
      {
        title: "Business-rule onboarding",
        items: [
          "ask Socratic questions only for facts that cannot be inferred confidently",
          "use numbered TUI options with a recommendation and business impact",
          "write initial BDD scenarios before tasks can move into development",
        ],
      },
      {
        title: "Model cohorts",
        items: [
          "after Pi login/provider configuration, ask which setup the customer wants to use",
          `seed default cohorts: ${DEFAULT_COHORTS.map((c) => c.name).join(", ")}`,
          "store selected provider/model/thinking/fallback per cohort in project config",
        ],
      },
      {
        title: "Persistent baseline",
        items: [
          "create markdown project docs, business rules by domain, decisions, knowledge, and agent guidance",
          "create internal kanban with workflow stages",
          "initialize SQLite state and vector-memory metadata",
          "check Ollama and nomic-embed-text; explain installation when missing",
        ],
      },
    ],
  };
}

export async function buildDoctorReport() {
  return {
    title: "aih-doctor report",
    summary: "Read-only checks for harness health.",
    sections: [
      {
        title: "Checks",
        items: [
          "Pi package installed and extension loaded",
          "project config present",
          "model cohorts configured",
          "kanban readable",
          "markdown rules/docs readable",
          "SQLite schema valid",
          "vector index present and not stale",
          "Ollama reachable and nomic-embed-text available",
          "Linear sync status, when configured",
          "worktree and lock status",
        ],
      },
    ],
  };
}

export async function buildUpdatePlan() {
  return {
    title: "aih-update plan",
    summary: "Update aihaus-pi version. This command does not repair corrupted local state.",
    sections: [
      {
        title: "Update scope",
        items: [
          "check installed version and latest configured release",
          "update package resources through Pi package mechanisms",
          "apply version migrations for templates and schemas",
          "preserve rules, kanban, memory, docs, and evidence",
          "recommend /aih-repair if corruption is detected",
        ],
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

export async function buildStatusReport() {
  return {
    title: "aih-status report",
    summary: "Internal kanban is the source of truth; Linear is only a sync interface.",
    sections: [
      {
        title: "Workflow",
        items: WORKFLOW_STAGES.map((stage) => `${stage.name}: ${stage.purpose}`),
      },
      {
        title: "Skill gateways",
        items: GATEWAYS.map((gateway) => `${gateway.name}: ${gateway.when}`),
      },
    ],
  };
}

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { WORKFLOW_STAGES } from "../workflow/stages.js";
import { DEFAULT_COHORTS } from "../models/cohorts.js";

export const AIHAUS_DIR = "aihaus-pi";

export function projectPath(cwd, ...parts) {
  return join(cwd, AIHAUS_DIR, ...parts);
}

export function toProjectRelative(cwd, path) {
  return relative(cwd, path).replaceAll("\\", "/");
}

export function readJsonFile(path, fallback = undefined) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function markFile(cwd, path, result) {
  const rel = toProjectRelative(cwd, path);
  if (existsSync(path)) {
    result.existing.push(rel);
    return false;
  }
  result.created.push(rel);
  return true;
}

export function defaultProjectConfig({ now = new Date().toISOString() } = {}) {
  return {
    version: 1,
    initializedAt: now,
    sourceOfTruth: "aihaus-pi local state",
    workflow: WORKFLOW_STAGES.map((stage) => stage.name),
    evidence: {
      directory: "aihaus-pi/evidence",
      requireHumanReview: true,
      uiUserFlowRequiresPlaywright: true,
    },
    memory: {
      markdown: "aihaus-pi/memory",
      runSummaries: "aihaus-pi/memory/run-summaries",
      vectorIndex: "aihaus-pi/state/memory-index.json",
    },
    mcp: {
      config: "aihaus-pi/mcp.json",
      enabled: true,
      requireExplicitInstallConfirmation: true,
    },
  };
}

export function defaultKanban() {
  return {
    version: 1,
    sourceOfTruth: "aihaus-pi",
    stages: WORKFLOW_STAGES.map((stage, index) => ({
      name: stage.name,
      purpose: stage.purpose,
      order: index + 1,
    })),
    tasks: [],
    blockers: [],
    questions: [],
    updatedAt: null,
  };
}

export function defaultMemoryIndex({ now = new Date().toISOString() } = {}) {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    embedding: {
      provider: "ollama",
      model: "nomic-embed-text",
      status: "not-indexed",
    },
    documents: [],
  };
}

export function defaultModelCohorts() {
  return {
    version: 1,
    cohorts: Object.fromEntries(
      DEFAULT_COHORTS.map((cohort) => [
        cohort.name,
        {
          provider: "",
          model: "",
          thinking: cohort.defaultThinking,
          fallback: [],
        },
      ]),
    ),
  };
}

export function defaultMcpConfig() {
  return {
    version: 1,
    servers: {},
  };
}

export async function ensureProjectBaseline({ cwd, now = new Date().toISOString() } = {}) {
  if (!cwd) throw new Error("ensureProjectBaseline requires cwd");

  const result = { created: [], existing: [] };
  const dirs = [
    projectPath(cwd),
    projectPath(cwd, "state"),
    projectPath(cwd, "rules"),
    projectPath(cwd, "memory"),
    projectPath(cwd, "memory", "run-summaries"),
    projectPath(cwd, "evidence"),
    projectPath(cwd, "logs"),
    projectPath(cwd, "tmp"),
  ];

  for (const dir of dirs) ensureDirectory(dir);

  const files = [
    [projectPath(cwd, "config.json"), defaultProjectConfig({ now })],
    [projectPath(cwd, "mcp.json"), defaultMcpConfig()],
    [projectPath(cwd, "state", "kanban.json"), defaultKanban()],
    [projectPath(cwd, "state", "model-cohorts.json"), defaultModelCohorts()],
    [projectPath(cwd, "state", "memory-index.json"), defaultMemoryIndex({ now })],
  ];

  for (const [path, value] of files) {
    if (markFile(cwd, path, result)) writeJsonFile(path, value);
  }

  const rulesPath = projectPath(cwd, "rules", "domain.md");
  if (markFile(cwd, rulesPath, result)) {
    writeFileSync(
      rulesPath,
      [
        "# Domain Rules",
        "",
        "## REG-000: Initial rule placeholder",
        "",
        "Quando:",
        "",
        "Entao:",
        "",
        "Nao deve:",
        "",
        "Evidencia:",
        "",
        "Fonte:",
        "",
        "Historico:",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  return result;
}

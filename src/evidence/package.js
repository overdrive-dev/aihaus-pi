import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeJsonFile } from "../state/project.js";
import { writeFileSync } from "node:fs";

function safeTaskId(taskId) {
  return String(taskId ?? "unassigned").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function markdownList(items, formatter) {
  if (!items?.length) return "- none";
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

export async function createEvidencePackage({
  cwd,
  taskId,
  summary,
  artifacts = [],
  checks = [],
  now = new Date().toISOString(),
} = {}) {
  if (!cwd) throw new Error("createEvidencePackage requires cwd");
  const safeId = safeTaskId(taskId);
  const directory = join(cwd, "aihaus-pi", "evidence", safeId);
  mkdirSync(directory, { recursive: true });

  const metadata = {
    version: 1,
    taskId: safeId,
    createdAt: now,
    summary: summary ?? "",
    artifacts,
    checks,
    humanReviewRequired: true,
  };

  const summaryMarkdown = [
    `# Evidence Package: ${safeId}`,
    "",
    `Created: ${now}`,
    "",
    "## Summary",
    "",
    summary ?? "No summary provided.",
    "",
    "## Checks",
    "",
    markdownList(checks, (check) => `${check.command ?? "unknown command"}: ${check.status === 0 ? "passed" : `status ${check.status ?? "unknown"}`}`),
    "",
    "## Artifacts",
    "",
    markdownList(artifacts, (artifact) => `${artifact.type ?? "artifact"}: ${artifact.path ?? "missing path"}`),
    "",
    "## Human Review",
    "",
    "- required before Aprovados/Deploy/Done",
    "",
  ].join("\n");

  writeFileSync(join(directory, "summary.md"), summaryMarkdown, "utf8");
  writeJsonFile(join(directory, "metadata.json"), metadata);

  return { taskId: safeId, directory, metadata };
}

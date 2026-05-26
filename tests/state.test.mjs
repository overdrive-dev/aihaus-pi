import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ensureProjectBaseline, readJsonFile } from "../src/state/project.js";
import { WORKFLOW_STAGES } from "../src/workflow/stages.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-state-"));
}

test("ensureProjectBaseline creates local harness state without overwriting existing files", async () => {
  const cwd = tempProject();
  try {
    const first = await ensureProjectBaseline({ cwd, now: "2026-05-26T00:00:00.000Z" });

    assert.ok(first.created.includes("aihaus-pi/config.json"));
    assert.ok(first.created.includes("aihaus-pi/state/kanban.json"));
    assert.ok(first.created.includes("aihaus-pi/mcp.json"));

    const kanban = readJsonFile(join(cwd, "aihaus-pi", "state", "kanban.json"));
    assert.deepEqual(
      kanban.stages.map((stage) => stage.name),
      WORKFLOW_STAGES.map((stage) => stage.name),
    );
    assert.deepEqual(kanban.tasks, []);

    const configPath = join(cwd, "aihaus-pi", "config.json");
    const manualConfig = JSON.parse(readFileSync(configPath, "utf8"));
    manualConfig.manual = "preserve me";
    writeFileSync(configPath, `${JSON.stringify(manualConfig, null, 2)}\n`);

    const second = await ensureProjectBaseline({ cwd, now: "2026-05-27T00:00:00.000Z" });
    assert.ok(second.existing.includes("aihaus-pi/config.json"));
    assert.equal(JSON.parse(readFileSync(configPath, "utf8")).manual, "preserve me");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

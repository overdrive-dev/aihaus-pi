import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createEvidencePackage } from "../src/evidence/package.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-evidence-"));
}

test("createEvidencePackage writes a durable evidence summary and metadata", async () => {
  const cwd = tempProject();
  try {
    const result = await createEvidencePackage({
      cwd,
      taskId: "TASK-007",
      summary: "Checkout UI validated with Playwright screenshot.",
      artifacts: [{ type: "screenshot", path: "screenshots/checkout.png" }],
      checks: [{ command: "npx playwright test", status: 0 }],
      now: "2026-05-26T00:00:00.000Z",
    });

    assert.equal(result.taskId, "TASK-007");
    assert.ok(existsSync(join(cwd, "aihaus-pi", "evidence", "TASK-007", "summary.md")));
    assert.ok(existsSync(join(cwd, "aihaus-pi", "evidence", "TASK-007", "metadata.json")));
    assert.match(readFileSync(join(cwd, "aihaus-pi", "evidence", "TASK-007", "summary.md"), "utf8"), /Checkout UI validated/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

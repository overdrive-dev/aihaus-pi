import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildContextPack } from "../src/context/pack.js";
import { createExecutionPlan } from "../src/execution/slices.js";
import { buildInitPlan } from "../src/runtime/plans.js";
import { readKanban, writeKanban } from "../src/state/kanban.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-budget-"));
}

test("buildContextPack enforces a budget while keeping the active execution slice", async () => {
  const cwd = tempProject();
  try {
    await buildInitPlan({ cwd });
    await createExecutionPlan({
      cwd,
      request: Array.from({ length: 12 }, (_, index) => `${index + 1}. Large task ${index + 1}`).join("\n"),
      now: "2026-05-26T00:00:00.000Z",
    });

    const kanban = readKanban(cwd);
    for (let index = 0; index < 40; index += 1) {
      kanban.tasks.push({ id: `TASK-${index}`, title: `Task with long title ${index} ${"x".repeat(80)}`, stage: "Planejamento" });
    }
    writeKanban(cwd, kanban);

    mkdirSync(join(cwd, "aihaus-pi", "rules"), { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      writeFileSync(join(cwd, "aihaus-pi", "rules", `rule-${index}.md`), `# Rule ${index}\n\n${"Important rule text. ".repeat(120)}`);
    }

    const pack = await buildContextPack({ cwd, prompt: "executar grande plano", maxChars: 2400 });
    assert.ok(pack.content.length <= 2400);
    assert.match(pack.content, /Execution cursor/);
    assert.match(pack.content, /Active slice: S001/);
    assert.match(pack.content, /Context budget/);
    assert.equal(pack.details.budget.truncated, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

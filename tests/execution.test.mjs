import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  advanceExecutionCursor,
  buildSlicedPrompt,
  createExecutionPlan,
  readExecutionState,
  shouldSliceInput,
} from "../src/execution/slices.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-execution-"));
}

const manyTasks = Array.from({ length: 10 }, (_, index) => `${index + 1}. Implement task ${index + 1} with tests and evidence`).join("\n");

test("createExecutionPlan writes a resumable cursor and continue.md", async () => {
  const cwd = tempProject();
  try {
    const state = await createExecutionPlan({
      cwd,
      request: manyTasks,
      reason: "test-overflow",
      now: "2026-05-26T00:00:00.000Z",
      maxSliceChars: 120,
    });

    assert.equal(state.status, "active");
    assert.equal(state.cursor.activeIndex, 0);
    assert.ok(state.slices.length >= 10);
    assert.equal(state.slices[0].id, "S001");
    assert.equal(state.slices[0].status, "active");
    assert.ok(existsSync(join(cwd, "aihaus-pi", "state", "execution.json")));
    assert.ok(existsSync(join(cwd, "aihaus-pi", "continue.md")));
    assert.match(readFileSync(join(cwd, "aihaus-pi", "continue.md"), "utf8"), /Active slice: S001/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("advanceExecutionCursor moves one slice at a time", async () => {
  const cwd = tempProject();
  try {
    await createExecutionPlan({ cwd, request: manyTasks, now: "2026-05-26T00:00:00.000Z" });
    const next = await advanceExecutionCursor({ cwd, now: "2026-05-26T00:01:00.000Z" });
    assert.equal(next.cursor.activeIndex, 1);
    assert.equal(next.slices[0].status, "done");
    assert.equal(next.slices[1].status, "active");

    const persisted = readExecutionState(cwd);
    assert.equal(persisted.cursor.activeIndex, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("shouldSliceInput detects oversized or multi-task prompts", () => {
  assert.equal(shouldSliceInput("short request", { maxPromptChars: 100, maxDetectedItems: 4 }), false);
  assert.equal(shouldSliceInput("x".repeat(101), { maxPromptChars: 100, maxDetectedItems: 4 }), true);
  assert.equal(shouldSliceInput(manyTasks, { maxPromptChars: 10_000, maxDetectedItems: 4 }), true);
});

test("buildSlicedPrompt preserves only the active slice contract", async () => {
  const cwd = tempProject();
  try {
    const state = await createExecutionPlan({ cwd, request: manyTasks, now: "2026-05-26T00:00:00.000Z" });
    const prompt = buildSlicedPrompt(state);
    assert.match(prompt, /Execute only active slice S001/);
    assert.match(prompt, /Do not execute later slices/);
    assert.ok(prompt.length < manyTasks.length + 1200);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

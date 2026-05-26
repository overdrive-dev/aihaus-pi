import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildExecutionReport } from "../src/runtime/plans.js";
import { createAihausPiExtension } from "../src/runtime/extension.js";
import { readExecutionState } from "../src/execution/slices.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-exec-command-"));
}

const request = Array.from({ length: 8 }, (_, index) => `- Work item ${index + 1}`).join("\n");

test("/aih-exec plan/status/next manage the persisted execution cursor", async () => {
  const cwd = tempProject();
  try {
    const plan = await buildExecutionReport({ cwd, args: `plan ${request}` });
    assert.equal(plan.level, "success");
    assert.match(plan.summary, /Execution plan created/);

    const status = await buildExecutionReport({ cwd, args: "status" });
    assert.match(status.sections.flatMap((section) => section.items).join("\n"), /S001/);

    await buildExecutionReport({ cwd, args: "next" });
    assert.equal(readExecutionState(cwd).cursor.activeIndex, 1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("extension transforms oversized user prompts into active-slice prompts", async () => {
  const cwd = tempProject();
  const events = new Map();
  const pi = {
    registerCommand() {},
    registerMessageRenderer() {},
    sendMessage() {},
    on(name, handler) {
      events.set(name, handler);
    },
  };

  try {
    await createAihausPiExtension(pi);
    const result = await events.get("input")({ text: request, source: "interactive" }, { cwd });
    assert.equal(result.action, "transform");
    assert.match(result.text, /Execute only active slice S001/);
    assert.equal(readExecutionState(cwd).cursor.activeIndex, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAihausPiExtension } from "../src/runtime/extension.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-extension-"));
}

test("extension commands publish visible markdown reports through Pi custom messages", async () => {
  const cwd = tempProject();
  const commands = new Map();
  const messages = [];
  const events = new Map();
  const notifications = [];
  const pi = {
    registerCommand(name, options) {
      commands.set(name, options);
    },
    registerMessageRenderer() {},
    sendMessage(message, options) {
      messages.push({ message, options });
    },
    on(name, handler) {
      events.set(name, handler);
    },
  };

  try {
    await createAihausPiExtension(pi);
    assert.ok(commands.has("aih-status"));
    await commands.get("aih-status").handler("", {
      cwd,
      ui: { notify: (title, level) => notifications.push({ title, level }) },
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].message.customType, "aihaus-pi.report");
    assert.equal(messages[0].message.display, true);
    assert.match(messages[0].message.content, /aih-status report/);
    assert.deepEqual(messages[0].options, { triggerTurn: false });
    assert.equal(notifications[0].title, "aih-status report");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("extension suppresses generic aborted assistant noise around aihaus commands", async () => {
  const cwd = tempProject();
  const commands = new Map();
  const events = new Map();
  const pi = {
    registerCommand(name, options) {
      commands.set(name, options);
    },
    registerMessageRenderer() {},
    sendMessage() {},
    on(name, handler) {
      events.set(name, handler);
    },
  };

  try {
    await createAihausPiExtension(pi);
    await commands.get("aih-update").handler("status", { cwd, ui: { notify() {} } });
    const result = await events.get("message_end")({
      message: {
        role: "assistant",
        stopReason: "aborted",
        errorMessage: "Request was aborted",
        content: [],
      },
    });

    assert.equal(result.message.stopReason, "stop");
    assert.equal(result.message.errorMessage, undefined);
    assert.deepEqual(result.message.content, [{ type: "text", text: "" }]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("extension injects an aihaus context pack before agent start", async () => {
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
    const result = await events.get("before_agent_start")({
      prompt: "avaliar pacote",
      systemPrompt: "base prompt",
    }, { cwd });

    assert.match(result.systemPrompt, /aihaus-pi operating rule/);
    assert.equal(result.message.customType, "aihaus-pi.context-pack");
    assert.equal(result.message.display, false);
    assert.match(result.message.content, /Gateway:/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

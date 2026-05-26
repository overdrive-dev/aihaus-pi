import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildMcpReport } from "../src/runtime/plans.js";
import { readMcpConfig } from "../src/mcp/config.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-mcp-"));
}

test("/aih-mcp add playwright creates the official Playwright MCP preset", async () => {
  const cwd = tempProject();
  try {
    const report = await buildMcpReport({ cwd, args: "add playwright" });
    assert.equal(report.level, "success");

    const config = readMcpConfig(cwd);
    assert.equal(config.servers.playwright.enabled, true);
    assert.equal(config.servers.playwright.type, "stdio");
    assert.equal(config.servers.playwright.command, "npx");
    assert.deepEqual(config.servers.playwright.args, ["-y", "@playwright/mcp@latest"]);
    assert.ok(config.servers.playwright.requiredFor.includes("ui-flow-evidence"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("/aih-mcp enable and disable mutate server state safely", async () => {
  const cwd = tempProject();
  try {
    await buildMcpReport({ cwd, args: "add playwright" });
    await buildMcpReport({ cwd, args: "disable playwright" });
    assert.equal(readMcpConfig(cwd).servers.playwright.enabled, false);

    await buildMcpReport({ cwd, args: "enable playwright" });
    assert.equal(readMcpConfig(cwd).servers.playwright.enabled, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("/aih-mcp install playwright is confirmation-gated by default", async () => {
  const cwd = tempProject();
  try {
    const report = await buildMcpReport({ cwd, args: "install playwright" });
    assert.equal(report.level, "warning");
    assert.match(report.summary, /requires explicit confirmation/);
    assert.ok(report.sections.some((section) => section.title === "Commands not run"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildMcpReport } from "../src/runtime/plans.js";
import { readMcpConfig } from "../src/mcp/config.js";
import { ensurePlaywrightConfig, PLAYWRIGHT_HEADLESS_ENV } from "../src/mcp/presets/playwright.js";

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
    assert.equal(config.servers.playwright.browser.defaultMode, "headed");
    assert.equal(config.servers.playwright.browser.slowMo, 0);
    assert.equal(config.servers.playwright.browser.headlessOptInArg, "--headless");
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
    assert.ok(report.sections.some((section) => section.title === "Config not written"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Playwright config defaults to headed and makes headless opt-in", () => {
  const cwd = tempProject();
  try {
    const result = ensurePlaywrightConfig({ cwd });
    assert.equal(result.status, "created");
    assert.equal(result.relativePath, "playwright.config.ts");

    const config = readFileSync(result.path, "utf8");
    assert.match(config, /headless,/);
    assert.match(config, new RegExp(`${PLAYWRIGHT_HEADLESS_ENV}=1`));
    assert.match(config, /process\.env\[HEADLESS_ENV\]/);
    assert.doesNotMatch(config, /slowMo\s*:/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("Playwright config generation preserves existing config", () => {
  const cwd = tempProject();
  try {
    const existingPath = join(cwd, "playwright.config.js");
    writeFileSync(existingPath, "export default {};\n", "utf8");

    const result = ensurePlaywrightConfig({ cwd });
    assert.equal(result.status, "skipped");
    assert.equal(result.relativePath, "playwright.config.js");
    assert.equal(existsSync(join(cwd, "playwright.config.ts")), false);
    assert.equal(readFileSync(existingPath, "utf8"), "export default {};\n");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

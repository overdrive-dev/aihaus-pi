import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export const PLAYWRIGHT_MCP_SERVER_NAME = "playwright";
export const PLAYWRIGHT_HEADLESS_ENV = "AIHAUS_PLAYWRIGHT_HEADLESS";
export const PLAYWRIGHT_FALLBACK_HEADLESS_ENV = "PLAYWRIGHT_HEADLESS";
export const PLAYWRIGHT_CONFIG_CANDIDATES = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"];

function toRelative(cwd, path) {
  return relative(cwd, path).replaceAll("\\", "/");
}

export function playwrightMcpPreset({ packageVersion = "latest" } = {}) {
  const packageSpec = packageVersion === "latest" ? "@playwright/mcp@latest" : `@playwright/mcp@${packageVersion}`;
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", packageSpec],
    enabled: true,
    trust: "project",
    timeoutMs: 30_000,
    browser: {
      defaultMode: "headed",
      slowMo: 0,
      headlessOptInArg: "--headless",
      headlessOptInEnv: PLAYWRIGHT_HEADLESS_ENV,
    },
    requiredFor: ["ui-flow-evidence", "browser-validation"],
    evidence: ["screenshot", "trace", "browser-state"],
    env: {},
    notes: [
      "Playwright MCP is used for browser inspection, screenshots, and interactive UI-flow evidence.",
      "Default local browser mode is headed with no slowMo so humans can watch evidence runs.",
      `Headless mode is opt-in: add --headless to the MCP args or set ${PLAYWRIGHT_HEADLESS_ENV}=1 for @playwright/test.`,
      "Use @playwright/test for deterministic automated regression tests; MCP evidence does not replace the test runner.",
    ],
  };
}

export function playwrightConfigTemplate() {
  return [
    'import { defineConfig, devices } from "@playwright/test";',
    "",
    "// aihaus-pi default: headed browser, no slowMo, so humans can watch local evidence runs.",
    `// Set ${PLAYWRIGHT_HEADLESS_ENV}=1 when a headless run is explicitly needed.`,
    `const HEADLESS_ENV = "${PLAYWRIGHT_HEADLESS_ENV}";`,
    `const FALLBACK_HEADLESS_ENV = "${PLAYWRIGHT_FALLBACK_HEADLESS_ENV}";`,
    'const trueValues = new Set(["1", "true", "yes", "on"]);',
    'const headless = trueValues.has(String(process.env[HEADLESS_ENV] ?? process.env[FALLBACK_HEADLESS_ENV] ?? "").toLowerCase());',
    "",
    "export default defineConfig({",
    '  testDir: "./tests",',
    "  use: {",
    "    headless,",
    '    trace: "on-first-retry",',
    '    screenshot: "only-on-failure",',
    '    video: "retain-on-failure",',
    "  },",
    "  projects: [",
    '    { name: "chromium", use: { ...devices["Desktop Chrome"] } },',
    "  ],",
    "});",
    "",
  ].join("\n");
}

export function findPlaywrightConfig(cwd) {
  if (!cwd) throw new Error("findPlaywrightConfig requires cwd");
  for (const candidate of PLAYWRIGHT_CONFIG_CANDIDATES) {
    const path = join(cwd, candidate);
    if (existsSync(path)) return { path, relativePath: toRelative(cwd, path) };
  }
  return undefined;
}

export function ensurePlaywrightConfig({ cwd } = {}) {
  if (!cwd) throw new Error("ensurePlaywrightConfig requires cwd");

  const existing = findPlaywrightConfig(cwd);
  if (existing) {
    return {
      status: "skipped",
      path: existing.path,
      relativePath: existing.relativePath,
      message: `Existing Playwright config preserved at ${existing.relativePath}.`,
    };
  }

  const path = join(cwd, "playwright.config.ts");
  writeFileSync(path, playwrightConfigTemplate(), "utf8");
  return {
    status: "created",
    path,
    relativePath: toRelative(cwd, path),
    message: `Created playwright.config.ts with headed default, no slowMo, and ${PLAYWRIGHT_HEADLESS_ENV}=1 headless opt-in.`,
  };
}

export function playwrightInstallPlan() {
  return [
    {
      command: "npm",
      args: ["install", "-D", "@playwright/test"],
      reason: "Install the Playwright test runner for deterministic UI/user-flow tests.",
    },
    {
      command: "npx",
      args: ["playwright", "install"],
      reason: "Install browser binaries required by Playwright tests and MCP browser validation.",
    },
  ];
}

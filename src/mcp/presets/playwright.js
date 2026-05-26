export const PLAYWRIGHT_MCP_SERVER_NAME = "playwright";

export function playwrightMcpPreset({ packageVersion = "latest" } = {}) {
  const packageSpec = packageVersion === "latest" ? "@playwright/mcp@latest" : `@playwright/mcp@${packageVersion}`;
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", packageSpec],
    enabled: true,
    trust: "project",
    timeoutMs: 30_000,
    requiredFor: ["ui-flow-evidence", "browser-validation"],
    evidence: ["screenshot", "trace", "browser-state"],
    env: {},
    notes: [
      "Playwright MCP is used for browser inspection, screenshots, and interactive UI-flow evidence.",
      "Use @playwright/test for deterministic automated regression tests; MCP evidence does not replace the test runner.",
    ],
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

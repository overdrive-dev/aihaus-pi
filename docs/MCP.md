# MCP Tool Providers

## Reader And Action

Reader: a maintainer or customer who wants aihaus-pi to use external tool providers such as Playwright MCP.

Post-read action: configure, diagnose, and govern MCP servers without weakening aihaus-pi's business-rule-first workflow.

## Principle

MCP servers are tool providers. They are not the source of truth.

The source of truth remains:

- business rules
- internal kanban
- markdown memory
- SQLite/vector memory metadata
- evidence packages
- human review

MCP tools add operational capability, for example browser inspection, GitHub access, Linear sync, cloud APIs, or domain systems. Every MCP use must be governed by the active workflow stage and evidence requirements.

## Project Config

MCP servers are configured per project in:

```text
aihaus-pi/mcp.json
```

Shape:

```json
{
  "version": 1,
  "servers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "enabled": true,
      "trust": "project",
      "timeoutMs": 30000,
      "browser": {
        "defaultMode": "headed",
        "slowMo": 0,
        "headlessOptInArg": "--headless",
        "headlessOptInEnv": "AIHAUS_PLAYWRIGHT_HEADLESS"
      },
      "requiredFor": ["ui-flow-evidence", "browser-validation"],
      "evidence": ["screenshot", "trace", "browser-state"],
      "env": {}
    }
  }
}
```

## Commands

| Command | Purpose |
| --- | --- |
| `/aih-mcp list` | Show configured MCP providers. |
| `/aih-mcp doctor` | Read-only MCP provider health check. |
| `/aih-mcp add playwright` | Add the official Playwright MCP preset. |
| `/aih-mcp install playwright --yes` | Install `@playwright/test` and browser binaries after explicit confirmation. |
| `/aih-mcp enable playwright` | Enable a configured provider. |
| `/aih-mcp disable playwright` | Disable a configured provider. |

Installs are confirmation-gated. Without `--yes`, aihaus-pi prints the commands it would run but does not mutate the project.

## Playwright Contract

Playwright has two roles:

1. `@playwright/test` is the deterministic automated test runner for CI and regression evidence.
2. `@playwright/mcp` is an MCP provider for browser inspection, screenshots, traces, and interactive UI-flow evidence.

Default browser policy for local aihaus evidence runs:

- headed by default so the user can watch the browser while validation happens
- no `slowMo` by default
- headless is explicit opt-in with `AIHAUS_PLAYWRIGHT_HEADLESS=1 npx playwright test` for `@playwright/test`, or by adding `--headless` to the Playwright MCP server args when needed
- `/aih-mcp install playwright --yes` creates `playwright.config.ts` only when the target project does not already have a Playwright config; existing configs are preserved

For UI or user-flow work, the Testes stage cannot exit without planned and actual evidence. Preferred evidence:

- Playwright automated test output when automatable
- screenshot/trace/video/browser state from Playwright MCP when visual validation is needed
- evidence summary in `aihaus-pi/evidence/<task-id>/summary.md`
- human review checklist approval as a separate gate

MCP evidence does not replace automated tests when tests are feasible.

## Bridge Runtime

At session start, aihaus-pi reads enabled MCP servers and exposes their tools to Pi through `pi.registerTool()`.

Tool names are prefixed:

```text
mcp_<server>_<tool>
```

For example:

```text
mcp_playwright_browser_snapshot
```

The bridge:

- starts stdio MCP servers only when enabled
- prefixes tool names to avoid collisions
- carries MCP errors as actionable tool errors
- uses a limited environment allowlist plus explicit server env entries
- records provider identity in tool result details

## Security Rules

- Do not install dependencies without explicit user confirmation.
- Prefer pinned package versions for production projects instead of `latest`.
- Do not expose secrets to MCP servers unless they are explicitly listed in `aihaus-pi/mcp.json`.
- Treat unknown MCP tools as external side effects.
- Record MCP usage and evidence in task journal/evidence artifacts when available.
- A failed MCP provider is a blocker for workflows that require that provider.

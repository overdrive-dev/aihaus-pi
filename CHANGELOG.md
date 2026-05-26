# Changelog

## 0.1.0 - 2026-05-26

Initial public scaffold plus functional harness baseline.

### Added

- Real project baseline creation under canonical `aihaus-pi/` artifact directory with config, kanban, model cohorts, memory metadata, rules, and evidence directories.
- Visible command reports for `/aih-init`, `/aih-doctor`, `/aih-status`, `/aih-update`, `/aih-repair`, and `/aih-cleanup`.
- `/aih-mcp` command family for listing, diagnosing, adding, installing, enabling, and disabling MCP providers.
- Official Playwright MCP preset using `@playwright/mcp` for browser inspection, screenshots, traces, and interactive UI-flow evidence.
- Playwright validation contract: `@playwright/test` for deterministic automated tests and Playwright MCP for visual/interative evidence.
- MCP bridge that registers enabled MCP tools into Pi with `mcp_<server>_<tool>` names.
- Real aihaus context pack injection with kanban facts, markdown rules, MCP providers, blockers, memory metadata, and evidence requirements.
- Evidence package writer for `aihaus-pi/evidence/<task-id>/summary.md` and `metadata.json`.
- Improved intent routing with validation and MCP-management gateways.
- Windows path preservation in update argument parsing.
- `.gitignore` keeps aihaus-pi runtime artifacts centralized under `aihaus-pi/` and excludes legacy `.aihaus-pi/` plus `.pi/` local runtime folders.

### Verification

- `npm run smoke` passes with 20/20 tests.
- `npm pack --dry-run --json` includes the MCP, context-pack, evidence, docs, skills, and template files needed for release.

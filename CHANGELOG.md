# Changelog

## 0.2.1 - 2026-05-26

### Fixed

- `/aih-update` in a target repository now reports aihaus-pi package status first and skips global Pi runtime updates by default.
- Pi runtime updates from `/aih-update` are opt-in via `--with-pi`, preventing failures caused by unrelated global Pi version/update checks.
- aihaus-pi install mode detection now distinguishes normal global npm installs, Pi-managed packages, linked global checkouts, and non-global package roots.
- Pi-managed aihaus-pi packages refresh with `pi update --extensions`; global npm installs refresh with `npm install -g`; clean linked checkouts can fast-forward with git; dirty linked checkouts are preserved.

### Verification

- `npm run smoke` passes with 33/33 tests.
- `npm pack --dry-run --json` verifies aihaus-pi `0.2.1` release files.

## 0.2.0 - 2026-05-26

### Added

- Sliced execution cursor for oversized or multi-task requests via `/aih-exec`.
- Automatic prompt transformation for large task bundles so agents execute only the active slice.
- Context-pack budget enforcement that preserves active slice, blockers, and evidence requirements first.
- Durable continuation handoff at `aihaus-pi/continue.md`.
- `docs/CONTEXT_MANAGEMENT.md` for context-budget and resume protocol.

### Verification

- `npm run smoke` passes with 27/27 tests after sliced-execution changes.
- `npm pack --dry-run --json` includes sliced-execution runtime, docs, and skill files.

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

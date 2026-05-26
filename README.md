# aihaus-pi

Business-rule-first autonomous development harness for Pi.

aihaus-pi is the Pi-native successor product inspired by aihaus-flow. It is not tied to Claude Code or to any specific model. It uses Pi as the agent platform, lets the customer map models by operational cohort, and drives work through business rules, BDD planning, TDD development, evidence, human review, and durable memory.

## Release Highlights

Current release notes are in `CHANGELOG.md`.

This release adds the functional local harness baseline, visible command reports, context-pack injection, MCP provider management, sliced execution for oversized requests, and the official Playwright MCP preset for UI/user-flow evidence.

## Product Contract

The user can ask for anything in natural language. aihaus-pi interprets the intent, consults project memory, routes to the right skill gateway, and only asks questions when existing rules, docs, history, code, tests, and memory are not enough.

Visible workflow:

```text
Backlog -> Planejamento -> Desenvolvimento -> Testes -> Revisao Humana -> Aprovados -> Deploy -> Done
```

Core rules:

- Planejamento produces BDD from business rules.
- Desenvolvimento requires TDD.
- Testes must run appropriate automated checks.
- UI and user-flow work requires Playwright test evidence when automatable and Playwright MCP screenshot/trace evidence when visual validation is needed.
- Revisao Humana is always required.
- Every useful conversation is persisted to kanban, markdown, SQLite memory, and history.
- Agents receive a Pi-native context pack with selected skills, project memory, vector hits, prior run summaries, kanban state, blockers, and required evidence before acting.
- Linear is an interface/sync target, not the source of truth.
- Models are selected by customer-defined cohorts, not hardcoded by the harness.

## Install

Install Pi first, then install this package from GitHub:

```powershell
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
npm install -g git+https://github.com/overdrive-dev/aihaus-pi.git
```

Start aihaus from the repository you want it to work on:

```powershell
cd C:\path\to\project
aihaus
```

The `aihaus` command is a thin launcher over Pi. It runs Pi with this aihaus-pi package loaded, so customers use the product command while the runtime remains Pi-native.

`aihaus` also reads Pi's `defaultProvider` and `defaultModel` from `~/.pi/agent/settings.json` and passes them explicitly to Pi when you do not provide `--provider` or `--model`. That keeps the launcher aligned with the provider you configured through `/login`.

Update both the Pi runtime used underneath aihaus and the global aihaus-pi package with:

```bash
aihaus update
```

This runs `pi update` first, then refreshes aihaus-pi. Normal global installs are refreshed through npm. Linked local development checkouts are updated with `git fetch --tags --prune`, `git pull --ff-only`, and `npm install --no-package-lock` when the checkout is clean; dirty checkouts are preserved with a clear note instead of being overwritten.

Inside a target repository, `/aih-update` reports aihaus-pi status first and refreshes aihaus-pi package resources without running the global Pi runtime update by default. Pass `--with-pi` when you explicitly want `/aih-update` to run `pi update` too. Use `/aih-update status` for a read-only status report.

For direct Pi package installation without the `aihaus` launcher:

```bash
pi install git:github.com/overdrive-dev/aihaus-pi@main
pi install git:github.com/overdrive-dev/aihaus-pi@main -l
```

## Local Memory Requirement

aihaus-pi relies on local repository memory to reduce hallucination and to let agents ground decisions in rules, history, code, tests, and prior evidence. Install Ollama and the embedding model before serious use:

```bash
ollama --version
ollama pull nomic-embed-text
```

If Ollama is missing, `/aih-init` and `/aih-doctor` explain how to install it and continue in degraded mode only when the selected workflow allows it.

## First Run

```text
/aih-init
```

The init flow:

1. Detects whether the repository has existing code or is empty.
2. Investigates existing docs, code, tests, and git history read-only.
3. Runs Socratic onboarding only for information that cannot be inferred.
4. Creates project docs, business-rule markdown, kanban state, and memory indexes.
5. Runs model cohort setup after the user logs in or configures providers in Pi.
6. Creates `aihaus-pi/mcp.json` so project MCP providers can be added under aihaus-pi policy gates.

## Local aihaus-pi Directory

aihaus-pi keeps project-local harness artifacts under `aihaus-pi/` by default. This includes kanban, MCP config, rule drafts, memory metadata, sliced-execution cursors, continuation handoffs, logs, temporary files, and evidence packages. Legacy hidden folders such as `.aihaus-pi/` and Pi's `.pi/` are ignored so aihaus-pi-owned artifacts stay under one visible product namespace.

## Sliced Execution For Large Requests

When a request is too large or contains many tasks, aihaus-pi splits it into resumable slices instead of sending one giant instruction block to the model. Cursor state is stored in `aihaus-pi/state/execution.json`, and cross-session handoff goes to `aihaus-pi/continue.md`.

```text
/aih-exec plan <large request>
/aih-exec status
/aih-exec next
```

The agent is instructed to execute only the active slice and not claim the full request is complete while pending slices remain.

## MCP And Playwright

aihaus-pi can manage MCP providers as project-scoped tool providers. MCP servers are not the source of truth; they provide capabilities that must still follow rules, kanban, evidence, and human-review gates.

The official Playwright preset is added with:

```text
/aih-mcp add playwright
```

That creates a `aihaus-pi/mcp.json` entry for `@playwright/mcp`. Dependency installation is explicit and confirmation-gated:

```text
/aih-mcp install playwright --yes
```

Playwright has two roles:

- `@playwright/test` is the deterministic automated test runner.
- `@playwright/mcp` is used for browser inspection, screenshots, traces, and interactive UI-flow evidence.

aihaus-pi defaults Playwright evidence runs to headed browser mode with no `slowMo`, so the user can watch validation happen. Headless runs are opt-in, for example:

```bash
AIHAUS_PLAYWRIGHT_HEADLESS=1 npx playwright test
```

`/aih-mcp install playwright --yes` creates a `playwright.config.ts` with that policy only when the target project does not already have a Playwright config.

## Core Commands

| Command | Purpose |
| --- | --- |
| `/aih-init` | Discover or bootstrap a project; configure cohorts; create memory baseline. |
| `/aih-doctor` | Read-only harness health check. |
| `/aih-update` | Run the aihaus update flow: underlying Pi runtime plus aihaus-pi package/version. |
| `/aih-repair` | Repair harness state without updating version. |
| `/aih-cleanup` | Clean safe harness leftovers, stale locks, worktrees, and caches. |
| `/aih-status` | Show internal kanban tasks, blockers, MCP providers, and next questions. |
| `/aih-mcp` | List, diagnose, add, install, enable, or disable MCP providers such as Playwright. |
| `/aih-exec` | Plan, inspect, advance, or clear sliced execution cursors for large requests. |

## Documentation

- `docs/PRD.md` defines product scope and non-negotiable behavior.
- `docs/ARCHITECTURE.md` defines modules and Pi integration points.
- `docs/WORKFLOW.md` defines workflow stages and gates.
- `docs/MODEL_COHORTS.md` defines cohort-based model routing.
- `docs/MCP.md` defines MCP provider configuration, Playwright evidence, and security gates.
- `docs/CONTEXT_MANAGEMENT.md` defines context budgeting and sliced execution.
- `CHANGELOG.md` summarizes release changes and verification evidence.
- `docs/INIT.md` defines project onboarding.
- `docs/AGENT_GOVERNANCE.md` defines agent, skill, and prior-run-memory rules.

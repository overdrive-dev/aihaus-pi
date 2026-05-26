# aihaus-pi

Business-rule-first autonomous development harness for Pi.

aihaus-pi is the Pi-native successor product inspired by aihaus-flow. It is not tied to Claude Code or to any specific model. It uses Pi as the agent platform, lets the customer map models by operational cohort, and drives work through business rules, BDD planning, TDD development, evidence, human review, and durable memory.

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
- UI and user-flow work prefers Playwright plus screenshot evidence at completion.
- Revisao Humana is always required.
- Every useful conversation is persisted to kanban, markdown, SQLite memory, and history.
- Agents receive a Pi-native context pack with selected skills, project memory, vector hits, prior run summaries, kanban state, blockers, and required evidence before acting.
- Linear is an interface/sync target, not the source of truth.
- Models are selected by customer-defined cohorts, not hardcoded by the harness.

## Install

Install Pi first, then install this package from GitHub:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
npm install -g git+https://github.com/overdrive-dev/aihaus-pi.git
```

Start aihaus from the repository you want it to work on:

```bash
cd /path/to/project
aihaus
```

The `aihaus` command is a thin launcher over Pi. It runs Pi with this aihaus-pi package loaded, so customers use the product command while the runtime remains Pi-native.

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

## Core Commands

| Command | Purpose |
| --- | --- |
| `/aih-init` | Discover or bootstrap a project; configure cohorts; create memory baseline. |
| `/aih-doctor` | Read-only harness health check. |
| `/aih-update` | Update aihaus-pi package/version. |
| `/aih-repair` | Repair harness state without updating version. |
| `/aih-cleanup` | Clean safe harness leftovers, stale locks, worktrees, and caches. |
| `/aih-status` | Show internal kanban tasks, blockers, and next questions. |

## Documentation

- `docs/PRD.md` defines product scope and non-negotiable behavior.
- `docs/ARCHITECTURE.md` defines modules and Pi integration points.
- `docs/WORKFLOW.md` defines workflow stages and gates.
- `docs/MODEL_COHORTS.md` defines cohort-based model routing.
- `docs/INIT.md` defines project onboarding.
- `docs/AGENT_GOVERNANCE.md` defines agent, skill, and prior-run-memory rules.

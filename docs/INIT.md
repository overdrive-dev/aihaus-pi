# Project Onboarding

## Reader And Action

Reader: a user running aihaus-pi in a new or existing repository.

Post-read action: know what `/aih-init` does and what information it may ask for.

## Purpose

`/aih-init` creates the project baseline for aihaus-pi. It replaces guesswork with discoverable, persistent context.

It works for:

- existing repositories
- empty repositories
- partially documented repositories
- stale aihaus-pi projects
- product ideas before code exists

## Existing Repository Flow

The agent starts read-only:

1. detect stack and package managers
2. inspect docs
3. inspect tests
4. inspect scripts and CI
5. inspect git history
6. detect domain entities and flows
7. infer existing rules from tests, code, docs, and comments
8. mark unknowns

It then writes the initial baseline:

- project overview
- rule book by domain
- decisions
- knowledge/gotchas
- agent guidance
- kanban state
- memory metadata
- MCP provider config at `aihaus-pi/mcp.json`
- sliced execution policy and continuation path
- run-memory policy
- Pi skill and session settings recommendations
- cohort config prompt

## Empty Repository Flow

If there is not enough code to infer context, the agent switches to Socratic onboarding.

It asks only what is needed, with options:

```text
O projeto ainda nao tem codigo suficiente para inferir o dominio.

Qual e o estado inicial?

1. Produto novo, vamos definir regras e arquitetura do zero
2. Repo existente, mas com pouca documentacao
3. Prototipo ou experimento, ainda sem dominio fechado

Recomendado: 1
Motivo: nao encontrei estrutura tecnica suficiente para inferir regras.

Digite 1, 2, 3 ou descreva:
```

## Cohort Setup

After provider login/configuration, init runs model cohort setup. The user chooses a preset or maps each cohort manually.

This happens during init because agents cannot operate reliably until the harness knows which model setup to use for planning, doing, reviewing, verifying, memory, and low-risk tasks.

## MCP Setup

Init creates an empty `aihaus-pi/mcp.json`. MCP providers are added explicitly with `/aih-mcp` commands.

The official Playwright preset is recommended when the project contains UI or user flows:

```text
/aih-mcp add playwright
/aih-mcp install playwright --yes
```

The first command records the provider. The second command mutates the project and therefore requires explicit confirmation. When no Playwright config exists, it creates `playwright.config.ts` with aihaus-pi's browser policy: headed by default, no `slowMo`, and headless opt-in via `AIHAUS_PLAYWRIGHT_HEADLESS=1`.

## Sliced Execution Setup

Init records the default execution-cursor policy in `aihaus-pi/config.json`.

Runtime execution state is created only when needed:

```text
aihaus-pi/state/execution.json
aihaus-pi/continue.md
```

The purpose is to prevent large task bundles from being partially executed after context compaction or model context exhaustion.

## Skills And Session Memory

Init must verify that aihaus-pi package skills are visible to Pi and ask whether the project should add extra trusted skill directories.

Init also configures the run-memory policy:

1. Keep raw Pi session JSONL as audit evidence.
2. Generate compact run summaries after meaningful agent work.
3. Index summaries, blockers, selected skills, and evidence into markdown and vector memory.
4. Prefer summaries in future agent context packs.
5. Read raw session entries only when exact evidence is needed.

Project-local session storage is recommended when the customer wants all run evidence to stay with the repository workspace. Global Pi sessions are acceptable when the customer prefers the default Pi behavior, but aihaus-pi must still record task-level run summaries in project memory.

## Output Labels

Facts must be labeled:

- inferred from code
- inferred from tests
- inferred from docs
- inferred from git history
- answered by user
- hypothesis
- unknown

Unknowns become questions or blockers. Hypotheses must not be treated as rules until confirmed.

## Refresh

`/aih-init --refresh` re-runs discovery and detects drift:

- docs disagree with code
- tests imply rules not documented
- rules lack evidence
- model cohorts missing
- vector memory stale
- MCP providers missing or unhealthy
- Playwright missing for UI/user-flow validation
- execution cursor points to a missing or completed slice
- kanban points to missing tasks

Refresh updates generated sections and preserves customer-authored sections.

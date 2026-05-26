# aihaus-pi PRD

## Reader And Action

Reader: a maintainer or contributor landing on aihaus-pi cold.

Post-read action: understand what product is being built, what must be true for the first public release, and which behavior is non-negotiable.

## Product Summary

aihaus-pi is a Pi-native autonomous development harness that starts from business rules instead of code instructions. The customer can ask for anything in natural language. The harness interprets intent, consults persisted memory, routes to the correct skill gateway, asks only necessary Socratic questions, and moves work through a simple internal kanban with strict gates.

It is a new public product under `overdrive-dev/aihaus-pi`. It is not a Claude Code package and does not hardcode any model. Customers configure providers and models by operational cohort.

## Non-Negotiable Principles

1. Business rules come before code.
2. Planning produces BDD.
3. Development requires TDD.
4. Evidence is required before closure.
5. Human review is always required.
6. Every useful conversation becomes persisted state.
7. Agents must consult markdown memory, SQLite/vector memory, kanban, and project docs before assuming facts.
8. Agents must have access to relevant skills and prior run memories from themselves and related agents.
9. Linear is only a synced interface; the internal kanban is the source of truth.
10. The harness is model-agnostic and Pi-native.
11. Agents are agnostic by default: no stack, model, provider, or implementation assumption is embedded in agent definitions.
12. MCP servers are external tool providers, not sources of truth, and must be configured through aihaus-pi policy gates.

## Primary User Experience

The customer describes a task in normal language. The harness:

1. Detects intent.
2. Looks up related rules, tasks, docs, code, tests, and memory.
3. Routes to a skill gateway.
4. Asks numbered Socratic questions only for unresolved rule gaps.
5. Stores the answers and updates the internal kanban.
6. Produces BDD before development.
7. Executes with TDD when approved.
8. Produces automated checks plus Playwright test and MCP screenshot/trace evidence when applicable.
9. Requires human checklist approval.
10. Updates rules, docs, breadcrumbs, memory, kanban, and external sync.

## Workflow

```text
Backlog -> Planejamento -> Desenvolvimento -> Testes -> Revisao Humana -> Aprovados -> Deploy -> Done
```

The visible workflow is intentionally simple. The rigor lives inside gates.

## Skill Gateways

The customer does not need to know which command to invoke. The intent router chooses the gateway:

- question
- brainstorm
- planning
- bugfix
- investigation
- autonomous-execution
- review
- docs-memory
- validation
- mcp-management

Commands may exist for explicit control, but conversational routing is the primary experience.

## Business Rule Contract

A conversation can begin with a light rule shape:

```text
Quando:
Entao:
Nao deve:
Evidencia:
```

The harness may enrich it with actor, context, impact, exceptions, source, confidence, and history. The customer should not need to write a full specification from scratch.

## Socratic Questions

Before asking, the harness must try to infer from existing context. If it cannot infer safely, it asks in TUI-friendly numbered form:

```text
Regra pendente: o que deve acontecer quando a pessoa ja tem perfil ativo?

1. Bloquear criacao e mostrar mensagem clara
2. Reativar ou atualizar o perfil existente
3. Permitir duplicado apenas em excecao definida

Recomendado: 1
Motivo: evita duplicidade e preserva identidade unica.

Digite 1, 2, 3 ou descreva outra regra:
```

The answer is saved as a traceable decision.

## Evidence

Every rule must have planned evidence before development and actual evidence before closure. Preference:

1. Automated tests for scalable regression coverage.
2. Playwright test output for UI and user flows when automatable.
3. Playwright MCP screenshot/trace/browser evidence when visual or interactive validation is needed.
4. Logs, API responses, screenshots, or operational evidence when automation is not enough.
5. Human checklist always required as a separate gate.

## Failure Modes That Are Unacceptable

- Implementing the wrong rule with false confidence.
- Missing a conflict with an existing rule.
- Closing UI/user-flow work without Playwright evidence when it is feasible.
- Closing without evidence.
- Losing traceability of who decided what, why, and with which evidence.

## MVP Scope

The first useful release should include:

- Pi package manifest.
- Pi extension with commands.
- Intent router and gateway registry.
- Project onboarding via `/aih-init`.
- Cohort-based model setup in init.
- Internal kanban schema.
- Markdown rule book structure.
- SQLite/vector memory placeholders and Ollama checks.
- MCP provider config with official Playwright preset.
- Doctor, update, repair, cleanup, status, and MCP commands.
- Agent governance specification.
- Skill and prior-run-memory access contract for agents.
- Smoke tests that prevent packaging drift.

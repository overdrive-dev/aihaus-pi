# Workflow

## Reader And Action

Reader: a user or implementer who needs to know how work moves through aihaus-pi.

Post-read action: classify a task and know what evidence is required before it can move forward.

## Visible Stages

```text
Backlog -> Planejamento -> Desenvolvimento -> Testes -> Revisao Humana -> Aprovados -> Deploy -> Done
```

## Stage Contracts

### Backlog

Captures raw demand. It may come from the user, internal kanban, or Linear sync. No execution happens here.

Exit: task has enough title/context to start discovery.

### Planejamento

Mandatory business-rule gate.

The agent must:

- run initial research
- consult existing rules and memory
- detect conflicts
- ask numbered Socratic questions only for unresolved gaps
- map impact
- define evidence
- write BDD

Exit: BDD scenarios and evidence plan are approved or the task is blocked with the next question saved.

### Desenvolvimento

TDD is mandatory.

The agent must:

- start from approved BDD
- create or update tests before or with implementation
- add code breadcrumbs where business rules are non-obvious
- update rules/docs when behavior changes

Exit: implementation exists, tests exist, and traceability from rule to change is recorded.

### Testes

Runs validation.

Required where applicable:

- unit/integration tests
- lint/typecheck/build
- Playwright test output for UI and user flows when automatable
- Playwright MCP screenshot/trace/browser evidence for visual or interactive UI validation
- smoke checks

Exit: evidence is attached in `aihaus-pi/evidence/<task-id>/` or blocker explains why it cannot be produced. UI/user-flow work cannot exit Testes without Playwright evidence when it is feasible.

### Revisao Humana

Always required.

The checklist validates:

- BDD represents the intended rule
- behavior matches expectation
- evidence is sufficient
- risk residual is acceptable
- docs/rules updates are appropriate

Exit: human approval or blocker.

### Aprovados

Queue of approved work waiting for release grouping.

Exit: selected for deploy.

### Deploy

Publishes to the target environment and captures deploy/smoke evidence.

Exit: deploy evidence and post-deploy smoke status.

### Done

Final closure.

Required:

- kanban updated
- markdown rules/docs updated
- SQLite/vector memory refreshed or marked fresh
- external sync completed if configured
- evidence linked
- MCP/tool usage recorded when external tools contributed to evidence

## Blockers

If a question cannot be answered in the current session, the task remains in Planejamento with a blocker. The blocker must include:

- pending business question
- options already proposed
- recommended option when possible
- impact of each option
- next action

## MCP And Playwright

MCP providers are allowed during workflow execution only when configured in `aihaus-pi/mcp.json` and surfaced through aihaus-pi policy gates.

Playwright is the default UI/user-flow validation provider:

- `@playwright/test` provides deterministic automated evidence.
- `@playwright/mcp` provides browser inspection, screenshots, traces, and interactive evidence.
- missing Playwright configuration is a blocker for UI/user-flow completion unless explicitly waived by human review with rationale.

## Linear

Linear mirrors internal kanban status and key decisions. It is not the source of truth.

# Architecture

## Reader And Action

Reader: an engineer implementing aihaus-pi.

Post-read action: add or change a module without breaking the product contract.

## Platform Boundary

aihaus-pi is a Pi package. Pi provides extension loading, commands, tools, events, sessions, model selection, and package distribution. aihaus-pi provides the business-rule-first harness on top.

Current Pi constraints that shape the design:

- Extensions can register commands and tools.
- Extensions can listen to lifecycle, input, agent, model, and tool events.
- `before_agent_start` can inject context or modify the system prompt.
- `input` can transform or handle raw user input before skill/template expansion.
- Pi packages can bundle extensions, skills, prompts, and themes.
- Pi settings support default provider, model, and thinking level.
- Custom models can be configured, including Ollama and other OpenAI-compatible providers.
- Pi sessions are persistent and can be addressed by session manager/RPC.

## Product Entrypoint

The public command is `aihaus`.

`aihaus` is not a fork of Pi. It is a thin npm binary that launches `pi -e <aihaus-pi package root>` and forwards all user arguments. This keeps the product brand and onboarding stable while preserving Pi as the runtime, package loader, TUI, session manager, model selector, and extension host.

Forking Pi is reserved for a future case where aihaus-pi needs to change Pi core behavior, rebrand the whole TUI/runtime, or expose startup semantics that cannot be expressed through Pi packages, extensions, settings, skills, prompts, or CLI wrapping.

## Modules

### Extension

Registers user-facing commands and lifecycle event hooks.

Responsibilities:

- command registration
- intent interception
- context-pack injection
- tool-call policy checks
- status notifications
- message rendering hooks later

### Intent Router

Classifies user input into one or more gateways. It must consult memory before finalizing routing when a task already exists.

Router output includes:

- intent
- confidence
- required gateways
- reason
- next question or action

### Skill Gateway

Each gateway has a playbook. Gateways are not just slash commands; they are operating modes with required context, allowed actions, evidence, and exit criteria.

### Workflow Engine

Owns internal kanban state. Linear can mirror it, but cannot replace it.

State transitions must be persisted before external sync.

### Rules And Docs

Business rules are markdown by domain. The format remains readable for humans, with enough structure for parsing later.

### Memory Core

The repo brain is native to aihaus-pi. Do not expose it as a separate product named aih-graph.

Responsibilities:

- markdown memory indexing
- code/test/doc indexing
- semantic lookup via local embeddings
- impact/callers/history lookup
- context pack construction

### Cohort Model Router

Maps operational cohort to provider/model/thinking/fallback. Agents declare cohort needs, not concrete models.

### Agent Governance

Agents are agnostic protocol definitions. They do not hardcode stack, model, provider, or assumptions about the customer repo.

Agent specs must declare:

- purpose
- gateway fit
- cohort
- required context pack
- allowed tools/actions
- evidence expectations
- anti-assumption rules

The product should include an agent-author/reviewer capability that helps create or review agent specs against current repository rules, customer workflow, and model cohort policy.

### Agent Context And Run Memory

Agents must have access to skills and memory before they act. Pi's skill loading model is progressive-disclosure: skills are discovered at startup by name/description and loaded in full on demand. aihaus-pi should use that model, but strengthen it with explicit context packs and tool access.

Each agent context pack includes:

- relevant Pi/aihaus-pi skills
- markdown rules and docs
- vector memory hits
- kanban task state
- prior run memories for the same agent and related agents
- prior evidence and blockers

Prior run memory is derived from Pi session JSONL, aihaus-pi task journals, and agent output artifacts. It is summarized into durable markdown and indexed into vector memory. Raw sessions are evidence; curated run summaries are what agents should consume by default.

The harness must not rely on the base model remembering what happened. It must persist useful run outcomes and make them available to future agents.

The Pi-native implementation has three layers:

1. Skill discovery: aihaus-pi ships package skills, accepts project/global skill paths from Pi settings, and records every selected `/skill:name` in the task journal.
2. Memory resolution: before a gateway starts, aihaus-pi reads the internal kanban, markdown rules, vector memory, and prior run summaries for the same agent and related agents.
3. Context injection: aihaus-pi injects a compact context pack before agent execution, using Pi extension context hooks or a hidden custom message. Raw Pi session JSONL stays available as audit evidence, but curated run summaries are the default input to agents.

This keeps the agent model-agnostic while still giving it the right working memory. The agent sees current rules, relevant skills, prior attempts, blockers, and evidence expectations without replaying entire conversations.

The context pack must identify every item as one of:

- selected skill
- rule/doc fact
- memory hit
- prior run summary
- kanban fact
- code/test fact
- user answer
- hypothesis
- unknown

### Maintenance

Maintenance commands are separate:

- `/aih-doctor`: read-only diagnosis
- `/aih-update`: version update only
- `/aih-repair`: state repair without version update
- `/aih-cleanup`: safe cleanup

## Data Sources

Agents must ground claims in:

- discovered skills and gateway playbooks
- markdown rules and docs
- SQLite/vector memory
- prior agent run memory
- kanban state
- task journal
- code/tests/docs when technical investigation is needed
- user answers

Claims are classified as:

- confirmed by rule/doc
- confirmed by memory/index
- confirmed by code/test
- explicit user answer
- probable inference
- unknown

Probable inference must be presented as a hypothesis. Unknowns must trigger a question or blocker.

## First Implementation Shape

The first scaffold keeps runtime modules small and dependency-light:

- extension entrypoint
- route/gateway registry
- workflow stage registry
- cohort registry
- command plans
- docs and smoke tests

SQLite, vector indexing, and Pi custom tools will be implemented in follow-up milestones without changing the public contract.

## Pi Documentation Basis

The current design follows the Pi docs for:

- skills loaded from package, project, global, settings, or CLI sources
- settings-controlled resources such as packages, extensions, skills, prompts, and session directory
- persistent JSONL sessions with tree entries, compaction summaries, branch summaries, and extension custom messages
- extension hooks that can inject context before the agent starts

# Agent Governance

## Reader And Action

Reader: a maintainer adding or editing aihaus-pi agents.

Post-read action: write an agent spec that is agnostic, grounded, and reviewable.

## Agent Contract

Agents must be agnostic.

They must not hardcode:

- customer stack
- provider or model
- framework
- file layout
- company workflow beyond the aihaus-pi contract
- unverified business assumptions

They may declare:

- gateway fit
- cohort
- tool requirements
- required context pack
- evidence expectations
- anti-assumption rules

## Required Context Pack

Before work, every agent receives or fetches:

- relevant skills and gateway playbooks
- task snapshot
- related rules
- related decisions
- related knowledge/gotchas
- similar past tasks
- prior run memories from this agent and related agents
- current blockers
- required playbook
- allowed actions
- evidence required

If context is missing or stale, the agent must say so, refresh if allowed, or register a blocker.

Context resolution order:

1. Identify the routed gateway and required playbook.
2. Select likely Pi/aihaus-pi skills by name and description.
3. Load business rules and project docs related to the task.
4. Query vector memory for similar rules, tasks, evidence, and gotchas.
5. Load curated prior run summaries for the same agent and related agents.
6. Load current internal kanban state, blockers, questions, and evidence status.
7. Inspect code, tests, or raw Pi session JSONL only when the previous sources cannot answer the question with enough confidence.

## Skills Access

Agents should be able to load skills relevant to the routed gateway. A planning agent may need business-rule planning and BDD skills; a repair agent may need harness maintenance skills; a verifier may need Playwright/evidence skills.

The router decides the initial skill set, but agents can request additional skills when the task changes. Every extra skill load must be recorded in the task journal so future runs know which instructions shaped the decision.

Skill access uses Pi's native discovery model:

- package skills shipped by aihaus-pi
- project skills configured by the customer
- global skills already trusted by the user
- explicit `/skill:name` loads when a user or gateway forces one

Agents must not assume a skill exists because a previous harness had it. They must discover available skills, state which one they used, and record the selection.

## Prior Run Memory

Agents must learn from previous runs without trusting raw conversation history blindly.

The durable form is:

- raw Pi session JSONL as audit evidence
- aihaus-pi task journal as workflow evidence
- markdown run summaries as curated memory
- vector index rows for semantic retrieval

Run memory should capture:

- what the agent tried
- what worked
- what failed
- what rules were updated
- what evidence closed the task
- what future agents should avoid

Agents must prefer curated run summaries over long raw transcripts, and fall back to raw session inspection only when exact evidence is needed.

Prior run memory must be scoped. The default lookup is:

- same task
- same agent
- related agents in the same gateway
- similar tasks linked by vector memory
- recent blockers for the same workflow stage

The agent should not load all historical sessions into context. If it needs exact evidence, it reads the relevant JSONL entries and cites the session, task, and evidence artifact that justified the conclusion.

## Meta Agent

aihaus-pi should include an agent-author/reviewer capability.

Purpose:

- help write new agent specs
- review existing agent specs
- ensure the agent follows repository rules
- ensure the agent maps to a cohort without naming a concrete model
- ensure the agent has a playbook and evidence expectations
- ensure anti-hallucination rules are explicit

This is a product differentiator: customers can evolve their agent workforce using the same rule-first governance applied to product work.

## Review Checklist

An agent spec is not acceptable unless:

- it declares its gateway or use case
- it declares cohort instead of model
- it declares which skill families it may need
- it requires memory/rule consultation
- it requires prior run memory lookup when similar tasks exist
- it distinguishes fact from inference
- it defines when to ask the user
- it defines evidence output
- it avoids repo-specific assumptions unless generated from project memory

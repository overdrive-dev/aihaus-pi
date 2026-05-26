# Context Management And Sliced Execution

## Reader And Action

Reader: a maintainer or operator who wants aihaus-pi to handle large requests reliably.

Post-read action: understand how aihaus-pi avoids prompt/context overflow and silent partial execution.

## Problem

Large instructions or requests with many associated tasks can exceed the active model context or cause an agent to execute only part of the request. The unacceptable failure mode is silent partial completion: the agent stops after a subset of work and reports success for the whole request.

## Principle

aihaus-pi must execute large work as a persisted queue with a cursor, not as one giant prompt.

The model sees a compact context pack and one active slice. The repository stores the durable plan and resume state.

## Artifact Locations

```text
aihaus-pi/state/execution.json
aihaus-pi/continue.md
```

`execution.json` is machine-readable cursor state. `continue.md` is a human/agent handoff file for cross-session recovery.

## Automatic Slicing

Before normal prompt execution, aihaus-pi checks whether the user input is oversized or contains many actionable items. If it does, the input is transformed into an active-slice prompt:

```text
Execute only active slice S001: ...
Do not execute later slices.
When this slice is complete, produce evidence and advance with /aih-exec next.
```

The original request is persisted in `execution.json` so it does not need to be replayed into every model turn.

Default triggers:

- prompt length above the configured character budget
- more than seven detected bullet/checklist/numbered action items

## Commands

| Command | Purpose |
| --- | --- |
| `/aih-exec plan <request>` | Explicitly create a sliced execution plan. |
| `/aih-exec status` | Show active slice and progress. |
| `/aih-exec next` | Mark the active slice done and advance one slice. |
| `/aih-exec clear` | Clear the execution cursor. |

## Context Budget

Context packs are budgeted. When data exceeds the budget, aihaus-pi preserves higher-priority sections first:

1. active execution slice
2. blockers and pending questions
3. evidence requirements
4. applicable rules/docs
5. current kanban facts
6. MCP provider metadata
7. memory index summary
8. raw diagnostic snapshot

Overflow details remain in `aihaus-pi/` state files and can be read explicitly when needed.

## Completion Rule

A slice is not complete until its evidence exists. `/aih-exec next` should be used only after verification for the current slice. Completing a slice does not imply the entire request is complete unless the cursor has no pending slices.

## Recovery

If a session is interrupted:

1. read `aihaus-pi/continue.md`
2. read `aihaus-pi/state/execution.json`
3. execute only the active slice
4. attach evidence
5. advance the cursor

This keeps work recoverable even when model context is compacted or the session is resumed by a different agent.

---
name: aih-exec
description: Manage long-running aihaus-pi execution cursors for oversized or multi-task requests.
---

# aih-exec

Use this command family when a request is too large or has too many associated tasks to execute safely in one model context.

Required behavior:

1. Split oversized/multi-task requests into independently resumable slices.
2. Persist cursor state in `aihaus-pi/state/execution.json`.
3. Write a human-readable handoff in `aihaus-pi/continue.md`.
4. Execute only the active slice. Do not claim the full request is complete while later slices remain pending.
5. Advance with `/aih-exec next` only after the active slice has evidence.
6. Keep context packs budgeted and prioritize active slice, blockers, rules, and evidence over backlog breadth.

Commands:

- `/aih-exec plan <request>` creates a sliced execution plan.
- `/aih-exec status` shows the current cursor.
- `/aih-exec next` marks the active slice done and advances one slice.
- `/aih-exec clear` clears the cursor.

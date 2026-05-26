---
name: aih-init
description: Bootstrap or refresh aihaus-pi project context, business rules, kanban, memory, and cohort-based model setup.
---

# aih-init

Run project onboarding before any autonomous execution.

Required behavior:

1. Discover existing repository facts read-only.
2. Ask Socratic numbered questions only for facts that cannot be inferred.
3. Create or refresh project docs, rule book, kanban, and memory metadata.
4. Run model cohort setup after provider login/configuration.
5. Check Ollama and `nomic-embed-text` for local memory.
6. Verify Pi can discover aihaus-pi skills and ask about extra trusted skill directories.
7. Configure run-memory policy for Pi session JSONL, curated summaries, and vector indexing.
8. Persist all answers, hypotheses, blockers, selected skills, evidence, and next questions.

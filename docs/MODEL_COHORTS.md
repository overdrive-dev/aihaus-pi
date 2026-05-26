# Model Cohorts

## Reader And Action

Reader: a customer configuring aihaus-pi for a project.

Post-read action: choose a model setup for each type of work after logging into Pi providers.

## Principle

aihaus-pi is model-agnostic. It defines operational cohorts. The customer chooses which provider/model/thinking/fallback setup powers each cohort.

Agents never hardcode model names. They declare cohort needs.

## Default Cohorts

| Cohort | Purpose | Typical Thinking |
| --- | --- | --- |
| planner-binding | High-stakes rules, architecture, ambiguity, conflict resolution | xhigh |
| planner | Normal planning, decomposition, BDD | high |
| researcher | Docs, codebase, and evidence research | medium |
| doer | Implementation under approved BDD/TDD | medium |
| reviewer | Adversarial review and risk checks | high |
| verifier | Goal-backward verification and evidence | high |
| memory | Repo brain, impact, callers, rules lookup | medium |
| cheap | Routing, summaries, formatting, housekeeping | low |

## Init Experience

After the user logs in or configures providers in Pi, `/aih-init` asks which setup to use:

```text
Modelo de trabalho: como voce quer configurar os cohorts?

1. Local-first
2. Balanced
3. Premium
4. Manual por cohort

Recomendado: 2
Motivo: usa modelos fortes onde risco e ambiguidade sao maiores, e modelos baratos para roteamento.

Digite 1, 2, 3, 4 ou descreva:
```

If the customer chooses manual, the agent asks one cohort at a time with available provider/model options from Pi where possible.

## Project Config Shape

The durable config can start as JSON:

```json
{
  "cohorts": {
    "planner-binding": {
      "provider": "openai",
      "model": "example-high-reasoning-model",
      "thinking": "xhigh",
      "fallback": []
    },
    "doer": {
      "provider": "anthropic",
      "model": "example-coding-model",
      "thinking": "medium",
      "fallback": []
    }
  }
}
```

The exact provider/model IDs are customer choices. aihaus-pi validates presence and reports missing providers in `/aih-doctor`.

## Ollama And Embeddings

Generation models are customer-selected. Local embeddings are required for the repo memory layer.

The onboarding flow checks:

```bash
ollama --version
ollama pull nomic-embed-text
```

If missing, the harness explains why local memory needs it and records degraded status.

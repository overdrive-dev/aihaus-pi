export const DEFAULT_COHORTS = [
  {
    name: "planner-binding",
    purpose: "High-stakes business rule, architecture, and ambiguity resolution.",
    defaultThinking: "xhigh",
  },
  {
    name: "planner",
    purpose: "Normal planning, decomposition, and BDD drafting.",
    defaultThinking: "high",
  },
  {
    name: "researcher",
    purpose: "Documentation, codebase, and evidence research.",
    defaultThinking: "medium",
  },
  {
    name: "doer",
    purpose: "Implementation under approved BDD and TDD.",
    defaultThinking: "medium",
  },
  {
    name: "reviewer",
    purpose: "Adversarial code, rule, plan, and integration review.",
    defaultThinking: "high",
  },
  {
    name: "verifier",
    purpose: "Goal-backward verification, checks, Playwright, screenshots, and evidence.",
    defaultThinking: "high",
  },
  {
    name: "memory",
    purpose: "Repository memory, rules lookup, callers, impact, and history.",
    defaultThinking: "medium",
  },
  {
    name: "cheap",
    purpose: "Low-risk formatting, summaries, routing, and housekeeping.",
    defaultThinking: "low",
  },
];

export const COHORT_SETUP_PRESETS = [
  {
    id: "local",
    label: "Local-first",
    description: "Use local/custom models where possible; cloud models only when configured by the customer.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Use stronger models for planning/review and cheaper models for low-risk routing.",
  },
  {
    id: "premium",
    label: "Premium",
    description: "Prefer strongest configured models for high-confidence autonomous work.",
  },
  {
    id: "manual",
    label: "Manual",
    description: "Ask the customer to map provider/model/thinking/fallback for each cohort.",
  },
];

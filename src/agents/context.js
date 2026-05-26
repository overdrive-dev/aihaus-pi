export const AGENT_CONTEXT_SOURCES = [
  {
    name: "skills",
    purpose: "Pi-discovered skills and aihaus-pi gateway playbooks available for on-demand loading.",
    piMechanism:
      "Package skills, project/global skills settings, and /skill:name commands provide progressive disclosure.",
  },
  {
    name: "markdown-memory",
    purpose: "Project rules, decisions, knowledge, docs, and agent guidance in markdown.",
    piMechanism: "Injected as curated context only after gateway routing selects the relevant rule/doc set.",
  },
  {
    name: "vector-memory",
    purpose: "Semantic lookup over rules, docs, code, tests, evidence, and past tasks.",
    piMechanism: "Queried by aihaus-pi before agent start; results are cited as memory hits, not assumed truth.",
  },
  {
    name: "run-memory",
    purpose: "Summaries and useful outcomes from prior agent/subagent runs, derived from session JSONL and task journals.",
    piMechanism:
      "Pi session JSONL remains audit evidence; aihaus-pi stores compact run summaries for default agent context.",
  },
  {
    name: "kanban",
    purpose: "Internal task state, blockers, next questions, BDD, and evidence status.",
    piMechanism: "Loaded from the internal kanban before Linear or other external sync is consulted.",
  },
  {
    name: "mcp-providers",
    purpose: "Configured MCP providers, tool provenance, Playwright readiness, and external evidence capabilities.",
    piMechanism: "Loaded from aihaus-pi/mcp.json and exposed through aihaus-pi bridge tools after policy checks.",
  },
];

export const PI_CONTEXT_MECHANISMS = [
  {
    name: "skill-discovery",
    role: "Let Pi discover package, project, global, and configured skill directories; load full skill bodies only when the gateway or user request requires them.",
  },
  {
    name: "session-indexing",
    role: "Read Pi session JSONL through the configured session directory or SessionManager APIs, then summarize relevant prior runs instead of replaying raw transcripts by default.",
  },
  {
    name: "custom-context-message",
    role: "Inject a short aihaus-pi context pack before agent execution using Pi custom messages or equivalent extension context hooks.",
  },
  {
    name: "task-journal",
    role: "Persist selected skills, questions, decisions, blockers, evidence, and run summaries in the internal kanban and memory store.",
  },
];

export const CONTEXT_PACK_INJECTION = {
  customType: "aihaus-pi.context-pack",
  display: false,
  maxDefaultSections: [
    "task",
    "gateway",
    "business-rules",
    "selected-skills",
    "memory-hits",
    "prior-run-summaries",
    "blockers",
    "mcp-providers",
    "evidence-required",
  ],
};

export function requiredContextSourceNames() {
  return AGENT_CONTEXT_SOURCES.map((source) => source.name);
}

export function buildAgentContextPlan({ gateway = "planning", agent = "default" } = {}) {
  return {
    agent,
    gateway,
    sourceOrder: requiredContextSourceNames(),
    mechanisms: PI_CONTEXT_MECHANISMS.map((mechanism) => mechanism.name),
    injection: CONTEXT_PACK_INJECTION.customType,
    rawSessionPolicy:
      "Use raw Pi session JSONL only for exact audit evidence; prefer curated summaries for normal agent context.",
  };
}

export const GATEWAYS = [
  {
    name: "question",
    when: "the user asks for an answer or explanation",
    playbook: "answer from memory; mark unknowns instead of guessing",
  },
  {
    name: "brainstorm",
    when: "the user has an open idea or product/architecture exploration",
    playbook: "explore options, run adversarial challenge, synthesize",
  },
  {
    name: "planning",
    when: "the user asks for a change whose business rule or impact must be defined",
    playbook: "consult memory, ask Socratic numbered questions, produce BDD",
  },
  {
    name: "bugfix",
    when: "the user reports wrong behavior",
    playbook: "identify expected business rule, reproduce, add failing test, fix",
  },
  {
    name: "investigation",
    when: "the system does not know whether a report is a bug, requirement, or environment issue",
    playbook: "read-only evidence gathering and hypotheses",
  },
  {
    name: "autonomous-execution",
    when: "BDD is approved and work can move through development",
    playbook: "TDD implementation, review, tests, evidence, human checklist",
  },
  {
    name: "review",
    when: "a plan, rule, implementation, or evidence package needs challenge",
    playbook: "adversarial findings or explicit clean justification",
  },
  {
    name: "docs-memory",
    when: "durable rules, decisions, project docs, or agent memory need promotion",
    playbook: "update markdown and vector/index metadata with traceability",
  },
  {
    name: "validation",
    when: "the user asks for tests, evidence, Playwright, screenshots, or release validation",
    playbook: "run goal-backward checks and package evidence before review",
  },
  {
    name: "mcp-management",
    when: "the user configures MCP providers or external tool servers",
    playbook: "configure, doctor, gate installs, and expose MCP tools through Pi policy",
  },
  {
    name: "execution-management",
    when: "the user manages oversized requests, slices, continuation, or execution cursors",
    playbook: "slice large work, execute only the active slice, persist continuation, and advance after evidence",
  },
];

const ROUTE_KEYWORDS = {
  "execution-management": ["aih-exec", "slice", "slices", "fatiar", "fatia", "cursor", "continue", "continuar", "contexto", "context"],
  "mcp-management": ["mcp", "playwright mcp", "aih-mcp", "servidor", "tool provider"],
  validation: ["validacao", "validação", "teste", "testes", "evidencia", "evidência", "screenshot", "playwright", "trace"],
  bugfix: ["bug", "erro", "falha", "quebrou", "corrigir", "fix"],
  brainstorm: ["ideia", "brainstorm", "explorar", "opcoes", "opções"],
  question: ["explica", "duvida", "dúvida", "pergunta", "como funciona"],
  investigation: ["investiga", "investigar", "descobre", "diagnostica", "diagnóstico"],
  "autonomous-execution": ["executa", "executar", "implementa", "implementar", "implantar", "aplicar"],
  review: ["avalia", "avaliar", "revisa", "revisar", "audita", "audit", "review"],
  "docs-memory": ["documenta", "documentar", "memoria", "memória", "registrar decisão", "decisao", "decisão"],
  planning: ["planeja", "planejar", "prd", "bdd", "regra", "requisito", "plano"],
};

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function routeIntentDetailed(text) {
  const lower = normalize(text);
  const scores = new Map();
  for (const [gateway, keywords] of Object.entries(ROUTE_KEYWORDS)) {
    let score = 0;
    const reasons = [];
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword);
      if (lower.includes(normalizedKeyword)) {
        score += normalizedKeyword.includes(" ") ? 2 : 1;
        reasons.push(keyword);
      }
    }
    if (score > 0) scores.set(gateway, { gateway, score, reasons });
  }

  const sorted = [...scores.values()].sort((a, b) => b.score - a.score || a.gateway.localeCompare(b.gateway));
  const best = sorted[0] ?? { gateway: "planning", score: 0, reasons: ["default business-rule planning"] };
  return {
    intent: best.gateway,
    confidence: Math.min(0.95, 0.45 + best.score * 0.15),
    reason: best.reasons.join(", "),
    candidates: sorted,
  };
}

export function routeIntent(text) {
  return routeIntentDetailed(text).intent;
}

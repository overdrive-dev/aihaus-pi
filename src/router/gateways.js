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
];

export function routeIntent(text) {
  const lower = text.toLowerCase();
  if (lower.includes("bug") || lower.includes("erro") || lower.includes("quebrou")) return "bugfix";
  if (lower.includes("ideia") || lower.includes("brainstorm")) return "brainstorm";
  if (lower.includes("explica") || lower.includes("duvida") || lower.includes("dúvida")) return "question";
  if (lower.includes("investiga") || lower.includes("descobre")) return "investigation";
  if (lower.includes("executa") || lower.includes("implementa")) return "autonomous-execution";
  return "planning";
}

export const WORKFLOW_STAGES = [
  {
    name: "Backlog",
    purpose: "Raw demand captured from the user, internal kanban, or an external interface such as Linear.",
  },
  {
    name: "Planejamento",
    purpose: "Business-rule gate. Produces BDD, impact map, evidence plan, and resolved assumptions.",
  },
  {
    name: "Desenvolvimento",
    purpose: "TDD implementation guided by approved BDD and current rules.",
  },
  {
    name: "Testes",
    purpose: "Automated checks, Playwright/screenshot evidence when applicable, and failure triage.",
  },
  {
    name: "Revisao Humana",
    purpose: "Mandatory human checklist over rules, BDD, evidence, risk, and business acceptance.",
  },
  {
    name: "Aprovados",
    purpose: "Accepted work waiting for deploy/release grouping.",
  },
  {
    name: "Deploy",
    purpose: "Publish to the target environment and capture deploy/smoke evidence.",
  },
  {
    name: "Done",
    purpose: "Final closure after docs, rules, kanban, memory, and external sync are updated.",
  },
];

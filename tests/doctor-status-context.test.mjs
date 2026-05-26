import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildDoctorReport, buildInitPlan, buildStatusReport, buildMcpReport } from "../src/runtime/plans.js";
import { buildContextPack } from "../src/context/pack.js";
import { readKanban, writeKanban } from "../src/state/kanban.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-context-"));
}

test("doctor reports missing baseline as actionable errors", async () => {
  const cwd = tempProject();
  try {
    const report = await buildDoctorReport({ cwd });
    assert.equal(report.level, "error");
    assert.ok(report.sections.flatMap((section) => section.items).some((item) => item.includes("missing aihaus-pi/config.json")));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("init creates baseline and status reads real kanban tasks and blockers", async () => {
  const cwd = tempProject();
  try {
    const init = await buildInitPlan({ cwd });
    assert.equal(init.level, "success");

    const kanban = readKanban(cwd);
    kanban.tasks.push({
      id: "TASK-001",
      title: "Validate checkout flow",
      stage: "Testes",
      blockers: ["Need Playwright screenshot evidence"],
      evidence: { required: ["playwright-screenshot"] },
    });
    writeKanban(cwd, kanban);

    const status = await buildStatusReport({ cwd });
    const lines = status.sections.flatMap((section) => section.items);
    assert.ok(lines.some((item) => item.includes("Testes: 1 task")));
    assert.ok(lines.some((item) => item.includes("TASK-001")));
    assert.ok(lines.some((item) => item.includes("Need Playwright screenshot evidence")));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("context pack includes gateway, rules, kanban, MCP tools, and UI evidence requirements", async () => {
  const cwd = tempProject();
  try {
    await buildInitPlan({ cwd });
    await buildMcpReport({ cwd, args: "add playwright" });
    mkdirSync(join(cwd, "aihaus-pi", "rules"), { recursive: true });
    writeFileSync(
      join(cwd, "aihaus-pi", "rules", "checkout.md"),
      "# Checkout Rules\n\nQuando: usuario paga\nEntao: pedido confirmado\nEvidencia: Playwright screenshot\n",
    );

    const kanban = readKanban(cwd);
    kanban.tasks.push({ id: "TASK-002", title: "Improve checkout UI", stage: "Planejamento" });
    writeKanban(cwd, kanban);

    const pack = await buildContextPack({ cwd, prompt: "implementar melhoria no fluxo de checkout UI" });
    assert.equal(pack.customType, "aihaus-pi.context-pack");
    assert.equal(pack.display, false);
    assert.match(pack.content, /Gateway: autonomous-execution/);
    assert.match(pack.content, /TASK-002/);
    assert.match(pack.content, /checkout.md/);
    assert.match(pack.content, /playwright/);
    assert.match(pack.content, /Playwright screenshot/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

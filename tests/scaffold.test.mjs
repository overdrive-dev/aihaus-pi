import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_COHORTS } from "../src/models/cohorts.js";
import { GATEWAYS, routeIntent } from "../src/router/gateways.js";
import { WORKFLOW_STAGES } from "../src/workflow/stages.js";
import {
  CONTEXT_PACK_INJECTION,
  PI_CONTEXT_MECHANISMS,
  buildAgentContextPlan,
  requiredContextSourceNames,
} from "../src/agents/context.js";
import { splitShellArgs } from "../src/runtime/update.js";

test("workflow exposes simplified visible stages", () => {
  assert.deepEqual(WORKFLOW_STAGES.map((s) => s.name), [
    "Backlog",
    "Planejamento",
    "Desenvolvimento",
    "Testes",
    "Revisao Humana",
    "Aprovados",
    "Deploy",
    "Done",
  ]);
});

test("cohorts are operational and model agnostic", () => {
  assert.ok(DEFAULT_COHORTS.length >= 8);
  for (const cohort of DEFAULT_COHORTS) {
    assert.ok(cohort.name);
    assert.ok(cohort.purpose);
    assert.ok(!JSON.stringify(cohort).toLowerCase().includes("claude"));
    assert.ok(!JSON.stringify(cohort).toLowerCase().includes("sonnet"));
    assert.ok(!JSON.stringify(cohort).toLowerCase().includes("opus"));
  }
});

test("gateway router covers the main operating modes", () => {
  const names = GATEWAYS.map((g) => g.name);
  for (const expected of [
    "question",
    "brainstorm",
    "planning",
    "bugfix",
    "investigation",
    "autonomous-execution",
    "review",
    "docs-memory",
    "validation",
    "mcp-management",
    "execution-management",
  ]) {
    assert.ok(names.includes(expected));
  }
  assert.equal(routeIntent("tem um erro no convite"), "bugfix");
  assert.equal(routeIntent("vamos brainstormar produto"), "brainstorm");
  assert.equal(routeIntent("instalar mcp do playwright"), "mcp-management");
  assert.equal(routeIntent("validar fluxo com screenshot"), "validation");
  assert.equal(routeIntent("continuar pelo cursor de fatias"), "execution-management");
});

test("docs encode BDD planning and TDD development", () => {
  const workflow = readFileSync(new URL("../docs/WORKFLOW.md", import.meta.url), "utf8");
  assert.match(workflow, /Planejamento/);
  assert.match(workflow, /BDD/);
  assert.match(workflow, /TDD is mandatory/);
});

test("agent governance requires agnostic agents", () => {
  const governance = readFileSync(new URL("../docs/AGENT_GOVERNANCE.md", import.meta.url), "utf8");
  assert.match(governance, /Agents must be agnostic/);
  assert.match(governance, /cohort instead of model/);
  assert.match(governance, /agent-author\/reviewer/);
});

test("agents require skills and prior run memory in context", () => {
  assert.deepEqual(requiredContextSourceNames(), [
    "skills",
    "markdown-memory",
    "vector-memory",
    "run-memory",
    "kanban",
    "mcp-providers",
    "execution-cursor",
  ]);
  const governance = readFileSync(new URL("../docs/AGENT_GOVERNANCE.md", import.meta.url), "utf8");
  assert.match(governance, /Skills Access/);
  assert.match(governance, /Prior Run Memory/);
});

test("context plan uses Pi-native skills, sessions, and custom context injection", () => {
  assert.ok(PI_CONTEXT_MECHANISMS.some((mechanism) => mechanism.name === "skill-discovery"));
  assert.ok(PI_CONTEXT_MECHANISMS.some((mechanism) => mechanism.name === "session-indexing"));
  assert.equal(CONTEXT_PACK_INJECTION.customType, "aihaus-pi.context-pack");

  const plan = buildAgentContextPlan({ gateway: "planning", agent: "planner" });
  assert.equal(plan.agent, "planner");
  assert.equal(plan.gateway, "planning");
  assert.equal(plan.injection, "aihaus-pi.context-pack");
  assert.ok(plan.rawSessionPolicy.includes("curated summaries"));
});

test("package exposes aihaus launcher without forking Pi", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.bin.aihaus, "bin/aihaus.js");
  assert.ok(packageJson.files.includes("bin"));
  assert.ok(packageJson.files.includes("src"));

  const launcher = readFileSync(new URL("../bin/aihaus.js", import.meta.url), "utf8");
  assert.match(launcher, /spawnSync\(piCommand, \["-e", packageRoot/);
  assert.match(launcher, /args\[0\] === "update"/);
  assert.match(launcher, /runAihausUpdate/);
  assert.match(launcher, /shell: process\.platform === "win32"/);
  assert.match(launcher, /defaultProvider/);
  assert.match(launcher, /defaultModel/);
  assert.doesNotMatch(launcher.toLowerCase(), /fork/);

  const architecture = readFileSync(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8");
  assert.match(architecture, /The public command is `aihaus`/);
  assert.match(architecture, /not a fork of Pi/);
});

test("update argument parser supports pi update pass-through flags", () => {
  assert.deepEqual(splitShellArgs('--self --force "npm:@scope/pkg"'), ["--self", "--force", "npm:@scope/pkg"]);
});

test("update argument parser preserves Windows paths", () => {
  assert.deepEqual(splitShellArgs(String.raw`--extension C:\tmp\repo "D:\quoted path\pkg"`), [
    "--extension",
    String.raw`C:\tmp\repo`,
    String.raw`D:\quoted path\pkg`,
  ]);
});

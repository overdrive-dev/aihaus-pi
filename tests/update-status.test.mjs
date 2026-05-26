import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildUpdatePlan } from "../src/runtime/plans.js";
import { inspectAihausPackage, parseAihausUpdateArgs, runAihausUpdate } from "../src/runtime/update.js";

function tempDir(prefix = "aihaus-pi-update-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

function fakePackageJson() {
  return {
    name: "aihaus-pi",
    version: "9.9.9-test",
    repository: { url: "git+https://github.com/overdrive-dev/aihaus-pi.git" },
  };
}

test("slash update planning defaults to aihaus package update, not global Pi runtime update", async () => {
  const cwd = tempDir();
  try {
    const report = await buildUpdatePlan({ cwd, args: "--status" });
    const lines = report.sections.flatMap((section) => section.items).join("\n");
    assert.match(lines, /current aihaus-pi version:/);
    assert.match(lines, /Pi runtime update: not selected/);
    assert.doesNotMatch(lines, /Pi runtime and package update: failed/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("parseAihausUpdateArgs lets slash commands skip Pi runtime by default", () => {
  assert.equal(parseAihausUpdateArgs([], { defaultIncludePi: false }).includePi, false);
  assert.equal(parseAihausUpdateArgs(["--with-pi"], { defaultIncludePi: false }).includePi, true);
  assert.equal(parseAihausUpdateArgs([], { defaultIncludePi: true }).includePi, true);
  assert.equal(parseAihausUpdateArgs(["status"], { defaultIncludePi: true }).statusOnly, true);
});

test("inspectAihausPackage identifies Pi-managed package roots", () => {
  const cwd = tempDir();
  try {
    const packageRoot = join(cwd, ".pi", "git", "github.com", "overdrive-dev", "aihaus-pi");
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify(fakePackageJson()));

    const status = inspectAihausPackage({
      packageRoot,
      packageJson: fakePackageJson(),
      cwd,
      npmCommand: "definitely-missing-npm-command",
    });

    assert.equal(status.installMode, "pi-managed-package");
    assert.equal(status.updateStrategy, "pi-package-update");
    assert.equal(status.currentVersion, "9.9.9-test");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("runAihausUpdate status-only never runs pi update", () => {
  const cwd = tempDir();
  try {
    const result = runAihausUpdate({
      argv: ["status"],
      cwd,
      packageRoot: cwd,
      packageJson: fakePackageJson(),
      piCommand: "definitely-must-not-run-pi",
      npmCommand: "definitely-must-not-run-npm",
    });

    assert.equal(result.ok, true);
    assert.equal(result.steps.length, 0);
    assert.equal(result.statusOnly, true);
    assert.equal(result.aihausStatus.currentVersion, "9.9.9-test");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

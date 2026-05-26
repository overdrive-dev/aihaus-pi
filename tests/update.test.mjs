import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { defaultGitCommand, runAihausUpdate } from "../src/runtime/update.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "aihaus-pi-update-"));
}

function createLinkedGlobalPackage(root) {
  const checkout = join(root, "checkout");
  const globalRoot = join(root, "global", "node_modules");
  mkdirSync(checkout, { recursive: true });
  mkdirSync(globalRoot, { recursive: true });
  symlinkSync(checkout, join(globalRoot, "aihaus-pi"), process.platform === "win32" ? "junction" : "dir");
  return { checkout, globalRoot };
}

test("defaultGitCommand uses git instead of git.cmd on Windows shells", () => {
  const previous = process.env.AIHAUS_GIT_COMMAND;
  try {
    delete process.env.AIHAUS_GIT_COMMAND;
    assert.equal(defaultGitCommand(), "git");
    process.env.AIHAUS_GIT_COMMAND = "custom-git";
    assert.equal(defaultGitCommand(), "custom-git");
  } finally {
    if (previous === undefined) delete process.env.AIHAUS_GIT_COMMAND;
    else process.env.AIHAUS_GIT_COMMAND = previous;
  }
});

function fakeSpawnFactory({ globalRoot, dirty = false } = {}) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd, stdio: options.stdio });
    if (command === "npm" && args.join(" ") === "root -g") {
      return { status: 0, stdout: `${globalRoot}\n`, stderr: "" };
    }
    if (command === "git" && args.join(" ") === "status --porcelain") {
      return { status: 0, stdout: dirty ? " M src/runtime/update.js\n" : "", stderr: "" };
    }
    if (command === "git" && args.join(" ") === "fetch --tags --prune") {
      return { status: 0, stdout: "fetched\n", stderr: "" };
    }
    if (command === "git" && args.join(" ") === "pull --ff-only") {
      return { status: 0, stdout: "Already up to date.\n", stderr: "" };
    }
    if (command === "npm" && args.join(" ") === "install --no-package-lock") {
      return { status: 0, stdout: "dependencies refreshed\n", stderr: "" };
    }
    return { status: 127, stdout: "", stderr: `unexpected command: ${command} ${args.join(" ")}` };
  };
  return { calls, spawn };
}

test("runAihausUpdate fast-forwards a clean linked aihaus-pi checkout", () => {
  const root = tempProject();
  try {
    const { checkout, globalRoot } = createLinkedGlobalPackage(root);
    const { calls, spawn } = fakeSpawnFactory({ globalRoot });

    const result = runAihausUpdate({
      argv: ["--aihaus-only"],
      cwd: root,
      packageRoot: checkout,
      packageJson: { name: "aihaus-pi", repository: { url: "git+https://github.com/overdrive-dev/aihaus-pi.git" } },
      npmCommand: "npm",
      gitCommand: "git",
      spawn,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.notes, ["Skipped Pi runtime update by request."]);
    assert.ok(calls.some((call) => call.command === "git" && call.args.join(" ") === "fetch --tags --prune"));
    assert.ok(calls.some((call) => call.command === "git" && call.args.join(" ") === "pull --ff-only"));
    assert.ok(calls.some((call) => call.command === "npm" && call.args.join(" ") === "install --no-package-lock"));
    assert.ok(result.steps.some((step) => step.name === "aihaus-pi linked checkout fast-forward"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runAihausUpdate preserves dirty linked checkout without failing the Pi update flow", () => {
  const root = tempProject();
  try {
    const { checkout, globalRoot } = createLinkedGlobalPackage(root);
    const { calls, spawn } = fakeSpawnFactory({ globalRoot, dirty: true });

    const result = runAihausUpdate({
      argv: ["--aihaus-only"],
      cwd: root,
      packageRoot: checkout,
      packageJson: { name: "aihaus-pi", repository: { url: "git+https://github.com/overdrive-dev/aihaus-pi.git" } },
      npmCommand: "npm",
      gitCommand: "git",
      stdio: "inherit",
      spawn,
    });

    assert.equal(result.ok, true);
    assert.ok(result.notes.some((note) => /has uncommitted changes/.test(note)));
    assert.ok(calls.some((call) => call.command === "git" && call.args.join(" ") === "status --porcelain" && call.stdio === "pipe"));
    assert.ok(!calls.some((call) => call.command === "git" && call.args.join(" ") === "pull --ff-only"));
    assert.ok(!calls.some((call) => call.command === "npm" && call.args.join(" ") === "install --no-package-lock"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

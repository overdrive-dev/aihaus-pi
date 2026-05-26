#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aihausUpdateHelp, defaultPiCommand, runAihausUpdate } from "../src/runtime/update.js";

const binDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(binDir, "..");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

const args = process.argv.slice(2);

if (args.includes("--aihaus-version")) {
  console.log(`aihaus-pi ${packageJson.version}`);
  process.exit(0);
}

if (args[0] === "update") {
  const updateArgs = args.slice(1);
  if (updateArgs.includes("--help") || updateArgs.includes("-h")) {
    console.log(aihausUpdateHelp());
    process.exit(0);
  }

  const result = runAihausUpdate({
    argv: updateArgs,
    cwd: process.cwd(),
    packageRoot,
    packageJson,
    stdio: "inherit",
    log: (line) => console.log(line),
    warn: (line) => console.warn(line),
  });
  process.exit(result.ok ? 0 : 1);
}

function hasFlag(argv, longName, shortName) {
  return argv.some((arg) => arg === longName || (shortName && arg === shortName) || arg.startsWith(`${longName}=`));
}

function readPiSettings() {
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? resolve(homedir(), ".pi", "agent");
  try {
    return JSON.parse(readFileSync(resolve(agentDir, "settings.json"), "utf8"));
  } catch {
    return {};
  }
}

function withConfiguredModelDefaults(argv) {
  if (
    hasFlag(argv, "--help", "-h") ||
    hasFlag(argv, "--version", "-v") ||
    hasFlag(argv, "--list-models") ||
    hasFlag(argv, "--export")
  ) {
    return argv;
  }

  const settings = readPiSettings();
  const next = [...argv];

  if (settings.defaultProvider && !hasFlag(next, "--provider")) {
    next.unshift("--provider", settings.defaultProvider);
  }

  if (settings.defaultModel && !hasFlag(next, "--model")) {
    next.unshift("--model", settings.defaultModel);
  }

  return next;
}

const piArgs = withConfiguredModelDefaults(args);
const piCommand = defaultPiCommand();
const result = spawnSync(piCommand, ["-e", packageRoot, ...piArgs], {
  stdio: "inherit",
  windowsHide: false,
  shell: process.platform === "win32",
});

if (result.error?.code === "ENOENT") {
  console.error("Pi nao encontrado. Instale com:");
  console.error("npm install -g --ignore-scripts @earendil-works/pi-coding-agent");
  process.exit(1);
}

if (result.error) {
  console.error(`Falha ao iniciar Pi: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

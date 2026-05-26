import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "README.md",
  "package.json",
  "extensions/aihaus-pi.ts",
  "src/runtime/extension.js",
  "src/router/gateways.js",
  "src/models/cohorts.js",
  "docs/PRD.md",
  "docs/ARCHITECTURE.md",
  "docs/WORKFLOW.md",
  "docs/MODEL_COHORTS.md",
  "docs/INIT.md",
];

for (const rel of required) {
  const path = join(root, rel);
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`missing required file: ${rel}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!packageJson.pi?.extensions?.length) throw new Error("package.json missing pi.extensions");
if (!packageJson.keywords?.includes("pi-package")) throw new Error("package.json missing pi-package keyword");

const docs = readdirSync(join(root, "docs")).filter((name) => name.endsWith(".md"));
if (docs.length < 5) throw new Error("expected at least five docs");

console.log("aihaus-pi scaffold check passed");

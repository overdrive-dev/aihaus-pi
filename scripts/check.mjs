import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "README.md",
  "package.json",
  "bin/aihaus.js",
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
if (packageJson.bin?.aihaus !== "bin/aihaus.js") throw new Error("package.json missing aihaus bin");
if (!packageJson.files?.includes("bin")) throw new Error("package.json files must include bin");
if (!packageJson.files?.includes("src")) throw new Error("package.json files must include src runtime");

const docs = readdirSync(join(root, "docs")).filter((name) => name.endsWith(".md"));
if (docs.length < 5) throw new Error("expected at least five docs");

const launcher = readFileSync(join(root, "bin/aihaus.js"), "utf8");
if (!launcher.includes('"--aihaus-version"')) throw new Error("aihaus launcher missing version probe");
if (!launcher.includes('"-e"')) throw new Error("aihaus launcher must load this package with pi -e");
if (!launcher.includes("shell: process.platform === \"win32\"")) {
  throw new Error("aihaus launcher must use shell mode on Windows for npm .cmd shims");
}
if (!launcher.includes("defaultProvider") || !launcher.includes("defaultModel")) {
  throw new Error("aihaus launcher must forward Pi defaultProvider/defaultModel when present");
}

console.log("aihaus-pi scaffold check passed");

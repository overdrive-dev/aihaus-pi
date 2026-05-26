import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "README.md",
  "CHANGELOG.md",
  "package.json",
  "bin/aihaus.js",
  "extensions/aihaus-pi.ts",
  "src/runtime/extension.js",
  "src/runtime/update.js",
  "src/mcp/config.js",
  "src/mcp/bridge.js",
  "src/context/pack.js",
  "src/evidence/package.js",
  "src/execution/slices.js",
  "src/router/gateways.js",
  "src/models/cohorts.js",
  "docs/PRD.md",
  "docs/ARCHITECTURE.md",
  "docs/WORKFLOW.md",
  "docs/MODEL_COHORTS.md",
  "docs/MCP.md",
  "docs/CONTEXT_MANAGEMENT.md",
  "docs/INIT.md",
  "skills/aih-mcp/SKILL.md",
  "skills/aih-exec/SKILL.md",
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
if (!packageJson.files?.includes("CHANGELOG.md")) throw new Error("package.json files must include CHANGELOG.md");
if (!packageJson.repository?.url) throw new Error("package.json missing repository url for aihaus update source");
if (!packageJson.dependencies?.["@modelcontextprotocol/sdk"]) {
  throw new Error("package.json missing MCP SDK runtime dependency");
}

const docs = readdirSync(join(root, "docs")).filter((name) => name.endsWith(".md"));
if (docs.length < 5) throw new Error("expected at least five docs");

const launcher = readFileSync(join(root, "bin/aihaus.js"), "utf8");
if (!launcher.includes('"--aihaus-version"')) throw new Error("aihaus launcher missing version probe");
if (!launcher.includes('"-e"')) throw new Error("aihaus launcher must load this package with pi -e");
if (!launcher.includes('args[0] === "update"')) throw new Error("aihaus launcher must intercept aihaus update");
if (!launcher.includes("runAihausUpdate")) throw new Error("aihaus launcher must run the update flow");
if (!launcher.includes("shell: process.platform === \"win32\"")) {
  throw new Error("aihaus launcher must use shell mode on Windows for npm .cmd shims");
}
if (!launcher.includes("defaultProvider") || !launcher.includes("defaultModel")) {
  throw new Error("aihaus launcher must forward Pi defaultProvider/defaultModel when present");
}

console.log("aihaus-pi scaffold check passed");

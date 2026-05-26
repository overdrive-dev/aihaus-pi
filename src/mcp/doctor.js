import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { commandForPlatform, hasMcpConfig, listMcpServers } from "./config.js";

function checkCommand(command, cwd) {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [commandForPlatform(command)] : ["-v", command];
  const result = spawnSync(probe, args, {
    cwd,
    shell: process.platform !== "win32",
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  });
  return result.status === 0;
}

export function inspectMcpServers(cwd) {
  if (!hasMcpConfig(cwd)) {
    return [
      {
        name: "mcp-config",
        status: "error",
        message: "missing aihaus-pi/mcp.json; run /aih-init or /aih-mcp add playwright",
      },
    ];
  }

  let servers;
  try {
    servers = listMcpServers(cwd);
  } catch (error) {
    return [
      {
        name: "mcp-config",
        status: "error",
        message: `aihaus-pi/mcp.json could not be parsed: ${error.message}`,
      },
    ];
  }
  if (servers.length === 0) {
    return [
      {
        name: "mcp-config",
        status: "warn",
        message: "no MCP servers configured",
      },
    ];
  }

  return servers.map((server) => {
    if (!server.enabled) {
      return { name: server.name, status: "warn", message: "configured but disabled" };
    }
    if (server.type !== "stdio") {
      return { name: server.name, status: "warn", message: `unsupported MCP server type for bridge: ${server.type}` };
    }
    if (!server.command) {
      return { name: server.name, status: "error", message: "stdio server is missing command" };
    }
    const commandOk = checkCommand(server.command, cwd);
    return {
      name: server.name,
      status: commandOk ? "ok" : "error",
      message: commandOk
        ? `${server.command} is available for stdio launch`
        : `${server.command} was not found on PATH`,
    };
  });
}

export function inspectPlaywrightProject(cwd) {
  const packageJsonPath = join(cwd, "package.json");
  const configExists = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"].some((name) =>
    existsSync(join(cwd, name)),
  );

  if (!existsSync(packageJsonPath)) {
    return { status: "warn", message: "package.json not found; cannot inspect @playwright/test" };
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const hasRunner = Boolean(packageJson.devDependencies?.["@playwright/test"] ?? packageJson.dependencies?.["@playwright/test"]);
    if (!hasRunner) return { status: "warn", message: "@playwright/test is not installed" };
    return {
      status: configExists ? "ok" : "warn",
      message: configExists ? "@playwright/test and config detected" : "@playwright/test installed; config not found",
    };
  } catch (error) {
    return { status: "error", message: `package.json could not be parsed: ${error.message}` };
  }
}

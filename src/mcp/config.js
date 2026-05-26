import { existsSync } from "node:fs";
import { projectPath, readJsonFile, writeJsonFile, defaultMcpConfig } from "../state/project.js";
import { PLAYWRIGHT_MCP_SERVER_NAME, playwrightMcpPreset } from "./presets/playwright.js";

export function mcpConfigPath(cwd) {
  return projectPath(cwd, "mcp.json");
}

export function readMcpConfig(cwd) {
  return readJsonFile(mcpConfigPath(cwd), defaultMcpConfig());
}

export function writeMcpConfig(cwd, config) {
  writeJsonFile(mcpConfigPath(cwd), normalizeMcpConfig(config));
}

export function normalizeMcpConfig(config = {}) {
  return {
    version: config.version ?? 1,
    servers: config.servers && typeof config.servers === "object" ? config.servers : {},
  };
}

export function addMcpPreset(cwd, name, options = {}) {
  const config = readMcpConfig(cwd);
  if (name !== PLAYWRIGHT_MCP_SERVER_NAME) {
    throw new Error(`unknown MCP preset: ${name}`);
  }

  const existed = Boolean(config.servers?.[name]);
  config.servers = {
    ...(config.servers ?? {}),
    [name]: {
      ...playwrightMcpPreset(options),
      ...(config.servers?.[name] ?? {}),
      enabled: true,
    },
  };
  writeMcpConfig(cwd, config);
  return { config, existed, server: config.servers[name] };
}

export function setMcpServerEnabled(cwd, name, enabled) {
  const config = readMcpConfig(cwd);
  if (!config.servers?.[name]) throw new Error(`MCP server not found: ${name}`);
  config.servers[name] = { ...config.servers[name], enabled };
  writeMcpConfig(cwd, config);
  return config.servers[name];
}

export function listMcpServers(cwd) {
  const config = readMcpConfig(cwd);
  return Object.entries(config.servers ?? {}).map(([name, server]) => ({ name, ...server }));
}

export function hasMcpConfig(cwd) {
  return existsSync(mcpConfigPath(cwd));
}

export function commandForPlatform(command, platform = process.platform) {
  if (platform === "win32" && ["npm", "npx", "node", "pi"].includes(command)) return `${command}.cmd`;
  return command;
}

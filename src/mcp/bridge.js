import { commandForPlatform, readMcpConfig } from "./config.js";

const SAFE_BASE_ENV = ["PATH", "Path", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "SYSTEMROOT", "SystemRoot"];

function sanitizeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "").slice(0, 80) || "tool";
}

function buildServerEnvironment(server) {
  const env = {};
  for (const key of SAFE_BASE_ENV) {
    if (process.env[key]) env[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(server.env ?? {})) {
    if (typeof value === "string" && value.startsWith("$")) {
      const source = value.slice(1);
      if (process.env[source]) env[key] = process.env[source];
    } else if (typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

async function loadMcpSdk() {
  try {
    const [{ Client }, { StdioClientTransport }] = await Promise.all([
      import("@modelcontextprotocol/sdk/client/index.js"),
      import("@modelcontextprotocol/sdk/client/stdio.js"),
    ]);
    return { Client, StdioClientTransport };
  } catch (error) {
    const wrapped = new Error(
      "@modelcontextprotocol/sdk is required to enable MCP bridge tools. Install package dependencies or run /aih-doctor for details.",
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

function normalizeToolContent(result) {
  if (!Array.isArray(result?.content)) {
    return [{ type: "text", text: JSON.stringify(result ?? {}, null, 2) }];
  }

  return result.content.map((item) => {
    if (item?.type === "text" && typeof item.text === "string") return { type: "text", text: item.text };
    return { type: "text", text: JSON.stringify(item, null, 2) };
  });
}

export async function registerConfiguredMcpTools(pi, ctx, { log = () => {} } = {}) {
  const cwd = ctx?.cwd ?? process.cwd();
  let config;
  try {
    config = readMcpConfig(cwd);
  } catch (error) {
    ctx?.ui?.notify?.(`MCP config invalid: ${error.message}`, "warning");
    return { registered: [], skipped: [{ name: "mcp-config", reason: error.message }] };
  }
  const servers = Object.entries(config.servers ?? {}).filter(([, server]) => server.enabled !== false);
  if (servers.length === 0) return { registered: [], skipped: [] };

  let sdk;
  try {
    sdk = await loadMcpSdk();
  } catch (error) {
    ctx?.ui?.notify?.(error.message, "warning");
    return { registered: [], skipped: servers.map(([name]) => ({ name, reason: error.message })) };
  }

  const registered = [];
  const skipped = [];

  for (const [serverName, server] of servers) {
    if (server.type !== "stdio") {
      skipped.push({ name: serverName, reason: `unsupported server type: ${server.type}` });
      continue;
    }

    try {
      const transport = new sdk.StdioClientTransport({
        command: commandForPlatform(server.command),
        args: server.args ?? [],
        env: buildServerEnvironment(server),
        cwd,
      });
      const client = new sdk.Client({ name: `aihaus-pi-${serverName}`, version: "0.1.0" }, { capabilities: {} });
      await client.connect(transport);
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools ?? [];

      for (const tool of tools) {
        const toolName = `mcp_${sanitizeName(serverName)}_${sanitizeName(tool.name)}`;
        pi.registerTool({
          name: toolName,
          label: `MCP ${serverName}: ${tool.name}`,
          description: [
            `MCP tool from server '${serverName}' with original name '${tool.name}'.`,
            tool.description ?? "No MCP tool description was provided by the server.",
            "Use only when the current aihaus-pi context pack or workflow gate requires this external capability.",
          ].join(" "),
          promptSnippet: `Call MCP ${serverName}/${tool.name} through aihaus-pi policy gates.`,
          parameters: tool.inputSchema ?? { type: "object", additionalProperties: true },
          async execute(_toolCallId, params, signal) {
            if (signal?.aborted) throw new Error("MCP tool call cancelled before execution.");
            const result = await client.callTool({ name: tool.name, arguments: params ?? {} });
            if (result?.isError) {
              const message = normalizeToolContent(result).map((item) => item.text).join("\n");
              throw new Error(message || `MCP tool ${serverName}/${tool.name} failed`);
            }
            return {
              content: normalizeToolContent(result),
              details: {
                server: serverName,
                originalTool: tool.name,
                result,
              },
            };
          },
        });
        registered.push({ server: serverName, originalTool: tool.name, toolName });
      }

      log(`registered ${tools.length} MCP tools from ${serverName}`);
    } catch (error) {
      skipped.push({ name: serverName, reason: error.message });
      ctx?.ui?.notify?.(`MCP ${serverName} skipped: ${error.message}`, "warning");
    }
  }

  return { registered, skipped };
}

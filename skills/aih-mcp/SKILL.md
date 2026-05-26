---
name: aih-mcp
description: Configure and diagnose aihaus-pi MCP tool providers, including the official Playwright preset for UI/user-flow evidence.
---

# aih-mcp

Manage MCP providers through aihaus-pi policy gates.

Required behavior:

1. Treat MCP servers as external tool providers, not source of truth.
2. Never install project dependencies unless the user gave explicit confirmation.
3. Prefer pinned MCP package versions for production projects.
4. Record configured MCP providers in `aihaus-pi/mcp.json`.
5. Use Playwright MCP for browser inspection, screenshots, and interactive UI-flow evidence.
6. Use `@playwright/test` for deterministic automated regression evidence.
7. Persist MCP/tool usage and generated evidence in the task journal/evidence package when available.

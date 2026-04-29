import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMonzoClientFromEnvironment } from "./monzoClient.js";
import { registerMonzoTools } from "./tools.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "monzo",
    version: "0.1.0",
  });

  registerMonzoTools({
    server,
    client: createMonzoClientFromEnvironment(),
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

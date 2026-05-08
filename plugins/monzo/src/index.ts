import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  createMonzoClientFromEnvironment,
  type MonzoClient,
  type MonzoRequestOptions,
} from "./monzoClient.js";
import { registerMonzoTools } from "./tools.js";

function createLazyMonzoClient(): Pick<MonzoClient, "request"> {
  let client: MonzoClient | undefined;

  return {
    async request<TResponse>(options: MonzoRequestOptions): Promise<TResponse> {
      client ??= createMonzoClientFromEnvironment();
      return client.request<TResponse>(options);
    },
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "monzo",
    version: "0.1.0",
  });

  registerMonzoTools({
    server,
    client: createLazyMonzoClient(),
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await main();
}

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/index.js";

const originalMonzoAccessToken = process.env.MONZO_ACCESS_TOKEN;
const originalMonzoApiBaseUrl = process.env.MONZO_API_BASE_URL;

function restoreEnvironment(): void {
  if (originalMonzoAccessToken === undefined) {
    delete process.env.MONZO_ACCESS_TOKEN;
  } else {
    process.env.MONZO_ACCESS_TOKEN = originalMonzoAccessToken;
  }

  if (originalMonzoApiBaseUrl === undefined) {
    delete process.env.MONZO_API_BASE_URL;
  } else {
    process.env.MONZO_API_BASE_URL = originalMonzoApiBaseUrl;
  }
}

describe("createServer", () => {
  afterEach(() => {
    restoreEnvironment();
  });

  it("constructs the MCP server without a Monzo access token", () => {
    delete process.env.MONZO_ACCESS_TOKEN;

    assert.doesNotThrow(() => {
      createServer();
    });
  });

  it("reports the existing token error when a Monzo tool is invoked without a token", async () => {
    delete process.env.MONZO_ACCESS_TOKEN;

    const server = createServer();
    const client = new Client({
      name: "monzo-test-client",
      version: "0.0.0",
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);

      const result = await client.callTool({
        name: "monzo_whoami",
        arguments: {},
      });

      assert.equal(result.isError, true);
      assert.deepEqual(result.content, [
        {
          type: "text",
          text: "MONZO_ACCESS_TOKEN is required to call the Monzo API.",
        },
      ]);
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MonzoClient, MonzoRequestOptions } from "../src/monzoClient.js";
import { MONEY_MOVEMENT_CONFIRMATION } from "../src/safety.js";
import { registerMonzoTools } from "../src/tools.js";

interface ToolHarness {
  client: Client;
  close: () => Promise<void>;
  requests: MonzoRequestOptions[];
}

async function createToolHarness({
  env = {},
  response = { ok: true },
}: {
  env?: NodeJS.ProcessEnv;
  response?: unknown;
} = {}): Promise<ToolHarness> {
  const requests: MonzoRequestOptions[] = [];
  const monzoClient: Pick<MonzoClient, "request"> = {
    async request<TResponse>(options: MonzoRequestOptions): Promise<TResponse> {
      requests.push(options);
      return response as TResponse;
    },
  };

  const server = new McpServer({
    name: "monzo-tools-test",
    version: "0.0.0",
  });
  registerMonzoTools({ server, client: monzoClient, env });

  const client = new Client({
    name: "monzo-tools-test-client",
    version: "0.0.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    requests,
    close: async () => {
      await Promise.allSettled([client.close(), server.close()]);
    },
  };
}

describe("registerMonzoTools", () => {
  it("maps list transactions tool input to the Monzo request shape", async () => {
    const response = { transactions: [{ id: "tx_123" }] };
    const harness = await createToolHarness({ response });

    try {
      const result = await harness.client.callTool({
        name: "monzo_list_transactions",
        arguments: {
          accountId: "acc_123",
          since: "2026-01-01T00:00:00Z",
          before: "2026-02-01T00:00:00Z",
          limit: 10,
          expandMerchant: true,
        },
      });

      assert.notEqual(result.isError, true);
      assert.deepEqual(result.content, [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ]);
      assert.deepEqual(harness.requests, [
        {
          path: "/transactions",
          query: {
            account_id: "acc_123",
            since: "2026-01-01T00:00:00Z",
            before: "2026-02-01T00:00:00Z",
            limit: 10,
            "expand[]": "merchant",
          },
        },
      ]);
    } finally {
      await harness.close();
    }
  });

  it("allows confirmed pot deposits and sends form-encoded request fields", async () => {
    const response = { pot: { id: "pot_123" } };
    const harness = await createToolHarness({
      env: { MONZO_ENABLE_MUTATIONS: "true" },
      response,
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_deposit_into_pot",
        arguments: {
          potId: "pot /123",
          sourceAccountId: "acc_123",
          amount: 1250,
          dedupeId: "dedupe-1",
          confirm: true,
          confirmationText: MONEY_MOVEMENT_CONFIRMATION,
        },
      });

      assert.notEqual(result.isError, true);
      assert.deepEqual(result.content, [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ]);
      assert.deepEqual(harness.requests, [
        {
          method: "PUT",
          path: "/pots/pot%20%2F123/deposit",
          form: {
            source_account_id: "acc_123",
            amount: 1250,
            dedupe_id: "dedupe-1",
          },
        },
      ]);
    } finally {
      await harness.close();
    }
  });

  it("blocks unconfirmed pot deposits before calling Monzo", async () => {
    const harness = await createToolHarness({
      env: { MONZO_ENABLE_MUTATIONS: "true" },
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_deposit_into_pot",
        arguments: {
          potId: "pot_123",
          sourceAccountId: "acc_123",
          amount: 1250,
          dedupeId: "dedupe-1",
          confirm: false,
          confirmationText: MONEY_MOVEMENT_CONFIRMATION,
        },
      });

      assert.equal(result.isError, true);
      assert.deepEqual(result.content, [
        {
          type: "text",
          text: `Mutating Monzo tools require confirm=true and confirmationText="${MONEY_MOVEMENT_CONFIRMATION}".`,
        },
      ]);
      assert.deepEqual(harness.requests, []);
    } finally {
      await harness.close();
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MonzoClient, MonzoRequestOptions } from "../src/monzoClient.js";
import { ACCOUNT_CHANGE_CONFIRMATION_ENV, MONEY_MOVEMENT_CONFIRMATION_ENV } from "../src/safety.js";
import { registerMonzoTools } from "../src/tools.js";

const privateAccountChangeConfirmation = "private-account-change-confirmation";
const privateMoneyMovementConfirmation = "private-money-movement-confirmation";

const mutationEnv: NodeJS.ProcessEnv = {
  MONZO_ENABLE_MUTATIONS: "true",
  [ACCOUNT_CHANGE_CONFIRMATION_ENV]: privateAccountChangeConfirmation,
  [MONEY_MOVEMENT_CONFIRMATION_ENV]: privateMoneyMovementConfirmation,
};

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
      env: mutationEnv,
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
          confirmationText: privateMoneyMovementConfirmation,
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

  it("allows confirmed pot withdrawals and sends form-encoded request fields", async () => {
    const response = { pot: { id: "pot_123" } };
    const harness = await createToolHarness({
      env: mutationEnv,
      response,
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_withdraw_from_pot",
        arguments: {
          potId: "pot /123",
          destinationAccountId: "acc_123",
          amount: 750,
          dedupeId: "dedupe-2",
          confirm: true,
          confirmationText: privateMoneyMovementConfirmation,
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
          path: "/pots/pot%20%2F123/withdraw",
          form: {
            destination_account_id: "acc_123",
            amount: 750,
            dedupe_id: "dedupe-2",
          },
        },
      ]);
    } finally {
      await harness.close();
    }
  });

  it("maps transaction annotations to Monzo metadata form fields", async () => {
    const response = { transaction: { id: "tx_123" } };
    const harness = await createToolHarness({
      env: mutationEnv,
      response,
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_annotate_transaction",
        arguments: {
          transactionId: "tx /123",
          metadata: {
            merchant_name: "Cafe",
            notes: "Lunch",
          },
          confirm: true,
          confirmationText: privateAccountChangeConfirmation,
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
          method: "PATCH",
          path: "/transactions/tx%20%2F123",
          form: {
            "metadata[merchant_name]": "Cafe",
            "metadata[notes]": "Lunch",
          },
        },
      ]);
    } finally {
      await harness.close();
    }
  });

  it("maps receipt creation to the Monzo JSON request body", async () => {
    const response = { receipt: { external_id: "receipt-1" } };
    const receipt = {
      external_id: "receipt-1",
      transaction_id: "tx_123",
      total: 1250,
      currency: "GBP",
    };
    const harness = await createToolHarness({
      env: mutationEnv,
      response,
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_create_receipt",
        arguments: {
          receipt,
          confirm: true,
          confirmationText: privateAccountChangeConfirmation,
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
          path: "/transaction-receipts",
          json: receipt,
        },
      ]);
    } finally {
      await harness.close();
    }
  });

  it("reports mutation requirements without leaking private confirmation text", async () => {
    const harness = await createToolHarness({
      env: mutationEnv,
    });

    try {
      const result = await harness.client.callTool({
        name: "monzo_confirmation_phrases",
        arguments: {},
      });

      assert.notEqual(result.isError, true);
      assert.ok(Array.isArray(result.content));
      const [content] = result.content;
      const textContent = content as { type?: unknown; text?: unknown };
      assert.equal(textContent.type, "text");
      const payloadText = textContent.text;
      if (typeof payloadText !== "string") {
        throw new TypeError("Expected monzo_confirmation_phrases to return text content.");
      }
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      assert.deepEqual(payload, {
        environmentFlag: "MONZO_ENABLE_MUTATIONS=true",
        moneyMovementConfirmationEnv: MONEY_MOVEMENT_CONFIRMATION_ENV,
        accountChangeConfirmationEnv: ACCOUNT_CHANGE_CONFIRMATION_ENV,
        valuesAreSecret: true,
      });
      const serialisedPayload = JSON.stringify(payload);
      assert.equal(serialisedPayload.includes(privateMoneyMovementConfirmation), false);
      assert.equal(serialisedPayload.includes(privateAccountChangeConfirmation), false);
    } finally {
      await harness.close();
    }
  });

  it("blocks unconfirmed pot deposits before calling Monzo", async () => {
    const harness = await createToolHarness({
      env: mutationEnv,
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
          confirmationText: privateMoneyMovementConfirmation,
        },
      });

      assert.equal(result.isError, true);
      assert.deepEqual(result.content, [
        {
          type: "text",
          text: `Mutating Monzo tools require confirm=true and the private money movement confirmation text configured in ${MONEY_MOVEMENT_CONFIRMATION_ENV}.`,
        },
      ]);
      assert.deepEqual(harness.requests, []);
    } finally {
      await harness.close();
    }
  });
});

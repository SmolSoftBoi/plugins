import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { MonzoClient } from "./monzoClient.js";
import { ACCOUNT_CHANGE_CONFIRMATION, MONEY_MOVEMENT_CONFIRMATION, assertMutationAllowed } from "./safety.js";

const accountIdSchema = z.object({
  accountId: z.string().min(1),
});

const confirmationSchema = {
  confirm: z.boolean(),
  confirmationText: z.string().min(1),
};

type ToolResultPayload = Record<string, unknown> | unknown[];

function jsonResult(payload: ToolResultPayload) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export interface RegisterMonzoToolsOptions {
  server: McpServer;
  client: MonzoClient;
  env?: NodeJS.ProcessEnv;
}

export function registerMonzoTools({ server, client, env = process.env }: RegisterMonzoToolsOptions): void {
  server.registerTool(
    "monzo_whoami",
    {
      title: "Monzo whoami",
      description: "Inspect the current Monzo access token and authenticated user.",
      inputSchema: {},
    },
    async () => jsonResult(await client.request({ path: "/ping/whoami" })),
  );

  server.registerTool(
    "monzo_list_accounts",
    {
      title: "List Monzo accounts",
      description: "List accounts visible to the authenticated Monzo user.",
      inputSchema: {
        accountType: z.string().optional(),
      },
    },
    async ({ accountType }) =>
      jsonResult(
        await client.request({
          path: "/accounts",
          query: { account_type: accountType },
        }),
      ),
  );

  server.registerTool(
    "monzo_read_balance",
    {
      title: "Read Monzo balance",
      description: "Read balance information for a Monzo account.",
      inputSchema: accountIdSchema.shape,
    },
    async ({ accountId }) =>
      jsonResult(
        await client.request({
          path: "/balance",
          query: { account_id: accountId },
        }),
      ),
  );

  server.registerTool(
    "monzo_list_pots",
    {
      title: "List Monzo pots",
      description: "List pots associated with a Monzo account.",
      inputSchema: accountIdSchema.shape,
    },
    async ({ accountId }) =>
      jsonResult(
        await client.request({
          path: "/pots",
          query: { current_account_id: accountId },
        }),
      ),
  );

  server.registerTool(
    "monzo_retrieve_transaction",
    {
      title: "Retrieve Monzo transaction",
      description: "Retrieve a Monzo transaction by ID.",
      inputSchema: {
        transactionId: z.string().min(1),
        expandMerchant: z.boolean().optional(),
      },
    },
    async ({ transactionId, expandMerchant }) =>
      jsonResult(
        await client.request({
          path: `/transactions/${encodeURIComponent(transactionId)}`,
          query: { "expand[]": expandMerchant ? "merchant" : undefined },
        }),
      ),
  );

  server.registerTool(
    "monzo_list_transactions",
    {
      title: "List Monzo transactions",
      description: "List transactions for a Monzo account, with optional date and pagination filters.",
      inputSchema: {
        accountId: z.string().min(1),
        since: z.string().optional(),
        before: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
        expandMerchant: z.boolean().optional(),
      },
    },
    async ({ accountId, since, before, limit, expandMerchant }) =>
      jsonResult(
        await client.request({
          path: "/transactions",
          query: {
            account_id: accountId,
            since,
            before,
            limit,
            "expand[]": expandMerchant ? "merchant" : undefined,
          },
        }),
      ),
  );

  server.registerTool(
    "monzo_retrieve_receipt",
    {
      title: "Retrieve Monzo receipt",
      description: "Retrieve a receipt by external ID.",
      inputSchema: {
        externalId: z.string().min(1),
      },
    },
    async ({ externalId }) =>
      jsonResult(
        await client.request({
          path: "/transaction-receipts",
          query: { external_id: externalId },
        }),
      ),
  );

  server.registerTool(
    "monzo_list_webhooks",
    {
      title: "List Monzo webhooks",
      description: "List webhooks registered for a Monzo account.",
      inputSchema: accountIdSchema.shape,
    },
    async ({ accountId }) =>
      jsonResult(
        await client.request({
          path: "/webhooks",
          query: { account_id: accountId },
        }),
      ),
  );

  server.registerTool(
    "monzo_deposit_into_pot",
    {
      title: "Deposit into Monzo pot",
      description: "Move money from a Monzo account into a pot. Requires explicit money movement confirmation.",
      inputSchema: {
        potId: z.string().min(1),
        sourceAccountId: z.string().min(1),
        amount: z.number().int().positive(),
        dedupeId: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ potId, sourceAccountId, amount, dedupeId, confirm, confirmationText }) => {
      assertMutationAllowed(env, "money", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "PUT",
          path: `/pots/${encodeURIComponent(potId)}/deposit`,
          form: {
            source_account_id: sourceAccountId,
            amount,
            dedupe_id: dedupeId,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_withdraw_from_pot",
    {
      title: "Withdraw from Monzo pot",
      description: "Move money from a Monzo pot into an account. Requires explicit money movement confirmation.",
      inputSchema: {
        potId: z.string().min(1),
        destinationAccountId: z.string().min(1),
        amount: z.number().int().positive(),
        dedupeId: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ potId, destinationAccountId, amount, dedupeId, confirm, confirmationText }) => {
      assertMutationAllowed(env, "money", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "PUT",
          path: `/pots/${encodeURIComponent(potId)}/withdraw`,
          form: {
            destination_account_id: destinationAccountId,
            amount,
            dedupe_id: dedupeId,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_annotate_transaction",
    {
      title: "Annotate Monzo transaction",
      description: `Update private metadata for a Monzo transaction. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        transactionId: z.string().min(1),
        metadata: z.record(z.string(), z.string()),
        ...confirmationSchema,
      },
    },
    async ({ transactionId, metadata, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      const form: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadata)) {
        form[`metadata[${key}]`] = value;
      }
      return jsonResult(
        await client.request({
          method: "PATCH",
          path: `/transactions/${encodeURIComponent(transactionId)}`,
          form,
        }),
      );
    },
  );

  server.registerTool(
    "monzo_create_feed_item",
    {
      title: "Create Monzo feed item",
      description: `Create a basic feed item in the Monzo app. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        accountId: z.string().min(1),
        title: z.string().min(1),
        imageUrl: z.string().url(),
        body: z.string().optional(),
        url: z.string().url().optional(),
        backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        titleColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        bodyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        ...confirmationSchema,
      },
    },
    async ({
      accountId,
      title,
      imageUrl,
      body,
      url,
      backgroundColor,
      titleColor,
      bodyColor,
      confirm,
      confirmationText,
    }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "POST",
          path: "/feed",
          form: {
            account_id: accountId,
            type: "basic",
            url,
            "params[title]": title,
            "params[image_url]": imageUrl,
            "params[body]": body,
            "params[background_color]": backgroundColor,
            "params[title_color]": titleColor,
            "params[body_color]": bodyColor,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_create_attachment_upload",
    {
      title: "Create Monzo attachment upload",
      description: `Create a temporary attachment upload URL. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        contentLength: z.number().int().positive(),
        ...confirmationSchema,
      },
    },
    async ({ fileName, fileType, contentLength, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "POST",
          path: "/attachment/upload",
          form: {
            file_name: fileName,
            file_type: fileType,
            content_length: contentLength,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_register_attachment",
    {
      title: "Register Monzo attachment",
      description: `Register an attachment against a transaction. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        externalId: z.string().min(1),
        fileUrl: z.string().url(),
        fileType: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ externalId, fileUrl, fileType, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "POST",
          path: "/attachment/register",
          form: {
            external_id: externalId,
            file_url: fileUrl,
            file_type: fileType,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_deregister_attachment",
    {
      title: "Deregister Monzo attachment",
      description: `Remove a registered attachment. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        attachmentId: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ attachmentId, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "POST",
          path: "/attachment/deregister",
          form: { id: attachmentId },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_create_receipt",
    {
      title: "Create Monzo receipt",
      description: `Create or update a transaction receipt using Monzo's JSON receipt API. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        receipt: z.record(z.string(), z.unknown()),
        ...confirmationSchema,
      },
    },
    async ({ receipt, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "PUT",
          path: "/transaction-receipts",
          json: receipt,
        }),
      );
    },
  );

  server.registerTool(
    "monzo_delete_receipt",
    {
      title: "Delete Monzo receipt",
      description: `Delete a receipt by external ID. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        externalId: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ externalId, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "DELETE",
          path: "/transaction-receipts",
          query: { external_id: externalId },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_register_webhook",
    {
      title: "Register Monzo webhook",
      description: `Register a webhook URL for a Monzo account. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        accountId: z.string().min(1),
        url: z.string().url(),
        ...confirmationSchema,
      },
    },
    async ({ accountId, url, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "POST",
          path: "/webhooks",
          form: {
            account_id: accountId,
            url,
          },
        }),
      );
    },
  );

  server.registerTool(
    "monzo_delete_webhook",
    {
      title: "Delete Monzo webhook",
      description: `Delete a Monzo webhook. Requires "${ACCOUNT_CHANGE_CONFIRMATION}".`,
      inputSchema: {
        webhookId: z.string().min(1),
        ...confirmationSchema,
      },
    },
    async ({ webhookId, confirm, confirmationText }) => {
      assertMutationAllowed(env, "account", { confirm, confirmationText });
      return jsonResult(
        await client.request({
          method: "DELETE",
          path: `/webhooks/${encodeURIComponent(webhookId)}`,
        }),
      );
    },
  );

  server.registerTool(
    "monzo_confirmation_phrases",
    {
      title: "Monzo confirmation phrases",
      description: "Return the exact confirmation phrases required for mutating tools.",
      inputSchema: {},
    },
    async () =>
      jsonResult({
        moneyMovement: MONEY_MOVEMENT_CONFIRMATION,
        accountChange: ACCOUNT_CHANGE_CONFIRMATION,
        environmentFlag: "MONZO_ENABLE_MUTATIONS=true",
      }),
  );
}

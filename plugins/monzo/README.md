# Monzo Codex Plugin

Unofficial Codex plugin for the [Monzo Developer API](https://docs.monzo.com/).
It exposes a local Model Context Protocol (MCP) server for account reads and
explicitly confirmed account-changing actions.

This plugin is not produced, endorsed, or maintained by Monzo.

## What It Does

- Reads Monzo account data using an existing developer access token.
- Supports Monzo API tools for accounts, balances, pots, transactions,
  receipts, attachments, feed items, and webhooks.
- Blocks every mutating tool unless you enable mutations and provide a private
  confirmation text configured outside the tool call.
- Avoids OAuth token exchange, refresh, and token storage in v1.

Monzo warns that the Developer API is not suitable for public applications. Use
it only with your own account or a small set of users you explicitly allow.

## Requirements

- Node.js 20.6 or newer.
- A Monzo Developer API access token from the Monzo developer tools or API
  playground.
- Strong Customer Authentication approval in the Monzo app before the token can
  access account data.

## Setup

```bash
npm --prefix plugins/monzo install
npm --prefix plugins/monzo run build
```

Then configure environment variables before starting the MCP server:

```bash
export MONZO_ACCESS_TOKEN="your-token"
export MONZO_ENABLE_MUTATIONS="false"
```

For account-changing tools, choose private confirmation text values and provide
them through the server environment before setting mutations to `true`:

```bash
export MONZO_MONEY_MOVEMENT_CONFIRMATION_TEXT="choose-a-private-money-movement-confirmation"
export MONZO_ACCOUNT_CHANGE_CONFIRMATION_TEXT="choose-a-private-account-change-confirmation"
```

Run the server directly for local checks:

```bash
npm --prefix plugins/monzo run start
```

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONZO_ACCESS_TOKEN` | Yes | Bearer token used for Monzo API calls. Never commit it. |
| `MONZO_ENABLE_MUTATIONS` | No | Set to `true` to permit account-changing tools. Defaults to blocked. |
| `MONZO_MONEY_MOVEMENT_CONFIRMATION_TEXT` | For pot transfers | Private confirmation text required by pot deposit and withdrawal tools. |
| `MONZO_ACCOUNT_CHANGE_CONFIRMATION_TEXT` | For other writes | Private confirmation text required by non-money-moving account changes. |
| `MONZO_API_BASE_URL` | No | Override API base URL for tests. Defaults to `https://api.monzo.com`. |

## Tools

Read-only tools:

- `monzo_whoami`
- `monzo_list_accounts`
- `monzo_read_balance`
- `monzo_list_pots`
- `monzo_retrieve_transaction`
- `monzo_list_transactions`
- `monzo_retrieve_receipt`
- `monzo_list_webhooks`
- `monzo_confirmation_phrases`

Mutating tools:

- `monzo_deposit_into_pot`
- `monzo_withdraw_from_pot`
- `monzo_annotate_transaction`
- `monzo_create_feed_item`
- `monzo_create_attachment_upload`
- `monzo_register_attachment`
- `monzo_deregister_attachment`
- `monzo_create_receipt`
- `monzo_delete_receipt`
- `monzo_register_webhook`
- `monzo_delete_webhook`

## Safety Gates

Mutating tools require all of the following:

- `MONZO_ENABLE_MUTATIONS=true`
- `confirm: true`
- `confirmationText` matching the relevant private environment value:
  - Pot transfers: `MONZO_MONEY_MOVEMENT_CONFIRMATION_TEXT`
  - Other account changes: `MONZO_ACCOUNT_CHANGE_CONFIRMATION_TEXT`

The plugin does not expose the configured private confirmation values through
MCP tools or error messages. These gates reduce accidental writes but do not
make broad account access safe. Keep tokens and confirmation text short-lived
where possible and remove them from your shell history.

## Examples

Read recent transactions:

```json
{
  "accountId": "acc_123",
  "limit": 20,
  "expandMerchant": true
}
```

Deposit into a pot:

```json
{
  "potId": "pot_123",
  "sourceAccountId": "acc_123",
  "amount": 500,
  "dedupeId": "transfer-2026-04-29-001",
  "confirm": true,
  "confirmationText": "your-private-money-movement-confirmation"
}
```

## Limits

- No OAuth authorisation flow, refresh handling, or token persistence.
- No hosted webhook receiver; this plugin can register and list webhook URLs
  only.
- No financial advice, affordability assessment, or account optimisation logic.
- API response shapes follow Monzo's live API and may change over time.

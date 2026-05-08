---
name: monzo-api
description: Use the Monzo Developer API through this plugin's MCP server while protecting tokens, personal financial data, and account-changing actions.
---

# Monzo API

Use this skill when a user asks Codex to inspect or change Monzo account data
through the local `monzo` MCP server.

## Safety Rules

- Treat `MONZO_ACCESS_TOKEN` and returned account data as highly sensitive.
- Never print, store, or hard-code access tokens.
- Prefer read-only tools unless the user explicitly asks to change their Monzo
  account.
- Never reveal or infer private Monzo mutation confirmation text values.
- Do not provide financial advice, affordability judgements, credit advice, tax
  advice, or investment recommendations from Monzo data.
- Summarise personal financial data only to the level needed for the user's
  request.

## Mutating Tool Confirmation

Before using any mutating Monzo tool, require all of:

- `MONZO_ENABLE_MUTATIONS=true` in the MCP server environment.
- The relevant private confirmation environment variable configured on the MCP
  server:
  - Pot transfers: `MONZO_MONEY_MOVEMENT_CONFIRMATION_TEXT`
  - Other account changes: `MONZO_ACCOUNT_CHANGE_CONFIRMATION_TEXT`
- `confirm: true` in the tool input.
- `confirmationText` matching the relevant private confirmation value.

If any requirement is missing, explain what is missing and do not retry the
mutation automatically.

## API Notes

- Monzo API base URL: `https://api.monzo.com`.
- Authentication uses `Authorization: Bearer <token>`.
- Form endpoints use `application/x-www-form-urlencoded`.
- Receipt creation uses a JSON request body.
- Pot transfer amounts use minor currency units, for example pennies for GBP.
- The Monzo Developer API is for personal or limited explicitly allowed users,
  not public applications.

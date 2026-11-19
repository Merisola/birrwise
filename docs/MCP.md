# Birrwise MCP (Model Context Protocol)

Birrwise exposes itself as a **remote MCP server** over Streamable HTTP so
AI assistants can read your ledger and help manage it — always under a
key you control, and with a two-step confirmation for anything touching
transactions or deleting data.

**Disabled by default.** Enable and manage it in the app:
**Settings → AI (MCP) access**.

- Endpoint: `https://birrwise-ten.vercel.app/api/mcp` (auth: `Authorization: Bearer <key>`)
- Secret URL: `https://birrwise-ten.vercel.app/api/mcp/<key>` (auth: none — the
  URL is the credential; for clients that cannot send headers)
- Keys are 256-bit (`mcp_…`), stored in the app's Setting table, constant-time
  compared, and rotatable at any time (the old key dies immediately).
- The endpoint is 404 while disabled, so its existence is not advertised.
- The SMS webhook key and all other app secrets are never exposed.

## What AI can do

| Scope | Tools |
| --- | --- |
| **Read (all)** | `get_summary`, `list_accounts`, `list_transactions`, `get_transaction`, `list_budgets`, `list_categories`, `list_rules`, `get_settings`, `resolve_account` |
| **Write freely** | `upsert_budget`, `create_category`, `update_category`, `create_rule`, `create_account`, `update_account` (balance sets absolute), `update_settings` |
| **Two-level (stage → you approve → confirm)** | `stage_transaction_create`, `stage_transaction_update`, `stage_transaction_delete`, `stage_transaction_set_label`, `stage_budget_delete`, `stage_category_delete`, `stage_rule_delete` → `confirm_action(token)` / `cancel_action(token)` / `list_pending_actions` |

Staged actions are single-use tokens (`mcp_cf_…`), 10-minute expiry, hashed at
rest. The assistant is instructed to show the exact preview and ask for your
explicit approval before confirming — never let it confirm on its own.

## Pay cycle

Monthly views use a configurable **pay cycle** instead of the calendar month.
`cycleStartDay` (1–28, default **7**) is an app setting: the cycle runs from
that day to the day before it next month (e.g. 7 → `7 Nov – 6 Dec`). All month
views follow it — `get_summary` / `list_transactions` with `period: "month"`,
the Transactions month filter, Budgets pacing and the Overview month label.
Week stays a rolling 7-day window; year stays the calendar year. Day boundaries
are computed in Africa/Addis_Ababa time; stored dates are Gregorian. A salary-like
income landing up to 3 days before the cycle start is treated as informational
and does **not** move cycle boundaries. Set it via `update_settings`
(`{"cycleStartDay": 15}`) or **Settings → General → PAY CYCLE START DAY**.

## Claude Desktop

**Option A — custom connector (no auth):** Settings → Connectors → Add custom
connector → paste your **Secret URL** → choose *no authentication*.

**Option B — `mcp-remote` bridge (Bearer header):** add to
`claude_desktop_config.json` and restart Claude:

```json
{
  "mcpServers": {
    "birrwise": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://birrwise-ten.vercel.app/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_KEY"
      ]
    }
  }
}
```

## ChatGPT (web)

Settings → Connectors → Add custom connector → paste your **Secret URL**,
choose *no authentication*. If ChatGPT refuses non-OAuth connectors, the
remaining path is a full OAuth 2.1 build — ask and it can be scoped.

## opencode / any MCP client

```json
{
  "mcp": {
    "birrwise": {
      "type": "remote",
      "url": "https://birrwise-ten.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_KEY" },
      "enabled": true
    }
  }
}
```

## Notes

- Amounts are always positive; `type` carries direction (`income` /
  `expense` / `transfer`). Transfers are excluded from income/expense totals.
- `stage_transaction_update` and deletes reverse/reapply balance effects, so
  the ledger stays consistent. Editing only labels/categories never touches
  balances.
- The settings page masks the key (last 4 only) and never returns it outside
  an explicit Reveal/Rotate from the authenticated UI.

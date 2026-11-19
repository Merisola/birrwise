# birrwise

A Next.js finance dashboard for tracking budgets, accounts, categories, and transactions with Prisma & PostgreSQL.

## Features

- Dashboard with balances, budgets, and spending breakdowns
- Wishlist — balance/budget-aware "can I afford this yet?" suggestions
- Transactions, accounts, categories, and rules management
- CSV import / export
- SMS webhook (`POST /api/webhooks/sms`) that parses bank alerts and records transactions
- Manual SMS recovery for alerts that never reached the webhook
  (**Import & export → Add a missed SMS**)
- Sign-in page for the dashboard and API (`/login`) backed by a signed
  session cookie; the SMS webhook uses its own `X-API-Key`

## Tech stack

- Next.js 14 (App Router) + React + Tailwind CSS
- Prisma + PostgreSQL in production, SQLite for local development

## Local setup

Local development uses SQLite by default, so no Postgres server is required.
`prisma/schema.sqlite.prisma` mirrors the production schema with a SQLite provider.

```bash
npm install
cp .env.example .env   # then set SMS_WEBHOOK_API_KEY
# For local dev, set DATABASE_URL="file:./dev.db" in .env
npm run db:push:local
npm run db:seed:local
npm run dev
```

`npm run dev` regenerates the Prisma client from the SQLite schema automatically.
To verify a production build locally, use `npm run build:local` (the deployed
`npm run build` targets PostgreSQL and runs `prisma db push`).

If `APP_USERNAME`, `APP_PASSWORD` and `SESSION_SECRET` are unset in local
development, authentication is disabled. Set all three in `.env` to test the
login page locally.

## Deploy to Vercel

The production app runs at **https://birrwise-ten.vercel.app** from
`Merisola/birrwise` (`main`). The Vercel project is connected to the repository,
so pushes to `main` deploy automatically.

1. Keep the existing Neon/Postgres database connected to the project. The build
   uses `DATABASE_URL`; if the project also provides `DATABASE_URL_UNPOOLED`
   and you add `directUrl` to `prisma/schema.prisma`, point it there.
2. Set these Vercel environment variables **before** deploying the version that
   enables the login page:
   - `SMS_WEBHOOK_API_KEY` — the same key used by MacroDroid
   - `APP_USERNAME` and `APP_PASSWORD` — dashboard/API login
   - `SESSION_SECRET` — signs the session cookie. Generate with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - Leave `ALLOW_SETTINGS_RESET` unset. It only enables the destructive demo
     reset endpoint when set to `true`.
3. Keep the build command as `prisma generate && prisma db push && next build`.
   The first deploy creates/updates the schema, including the unique
   `Transaction.fingerprint` column used for race-safe SMS deduplication.
   Node.js is pinned to 26 in `package.json` (`engines`) and in the Vercel
   project settings. Vercel no longer accepts Node 20 (discontinued).
4. `vercel.json` disables preview deployments (`"*": false`, `"main": true`),
   so preview builds cannot touch the production database. Use a separate
   Neon branch/database if you ever want previews again.
5. The production database intentionally starts empty. Do **not** call the demo
   reset endpoint. After the first deploy, create:
   - `Telebirr` — Mobile wallet, short `Telebirr`, opening balance `4135.57`
   - `Cash` — Cash wallet, short `Cash`, balance `0`
6. Point MacroDroid at `https://birrwise-ten.vercel.app/api/webhooks/sms` with
   the existing `X-API-Key` header.

The webhook is excluded from login auth and still requires `X-API-Key`. Never
commit `.env` or production credentials.

## Missed SMS recovery

If an alert never reached the webhook (phone offline, MacroDroid failure,
forwarding paused), open **Import & export → Add a missed SMS**, paste the raw
message (sender defaults to `Telebirr`) and preview it. The flow uses the same
parser as the webhook — service fees, VAT, stated balances and deduplication are
handled identically, so pasting the same SMS twice never creates a duplicate.

Manual backfills apply the transaction amount to the balance but never roll the
balance back to a historical value stated in an old SMS. When the pasted message
is the newest activity on the account, the preview confirms whether the
resulting balance matches the balance stated in the SMS; a mismatch usually
means another alert is also missing.

For fewer gaps, configure MacroDroid to retry failed HTTP requests while the
phone is offline — the `Transaction.fingerprint` column makes retries safe.

## Wishlist

**Wishlist** tracks the things you want (not things you must have) and tells
you when you can afford one — using your balance, your budgets and your
spending, not willpower alone.

The top line is **safe to spend**:

```
safe to spend = max(0, liquid balance
                    − late-salary runway (manual)
                    − unspent part of each budget this cycle)
```

- **Late-salary runway** is a manual amount you set (Wishlist page or
  Settings → Wishlist). Salary can arrive up to ~9 days after the cycle
  boundary and remaining budgets only reserve money through the cycle end, so
  the runway covers the gap. Suggestions pause until it is set.
- Budgets are reserved for the rest of the current pay cycle, line by line,
  so committed money never looks "available". Overspent budgets contribute 0.
- **Cooling-off**: an item cannot show as Ready for N days after it was added
  (default 14, configurable 0–365). Buying during cooling needs an extra
  explicit confirmation tick.
- **Average income** is a manual override too — it unlocks "cycles away"
  timeline estimates. Before your first eligible completed cycle, the surplus
  estimate is `income override − Σ limits of non-one-off budgets`. Cycles that
  started before your first transaction are ignored. Once eligible cycles
  exist, the app uses your actual recurring expenses (one-off categories and
  transfers excluded).
- **One-off categories** (e.g. partner repayments) are excluded from the
  surplus estimate only — they still count toward budgets, reports and the
  safe-to-spend reservation.
- With no tempting suggestion covered by the numbers, the card says so —
  it never invents headroom.

Important: rent, repayments and similar obligations must be logged as
**expenses in their category (not as transfers)**. Transfers are excluded
from spending math, so a rent logged as a transfer never reduces the
reservation and items will look more affordable than they are.

Buying an item is one atomic step: it creates the expense, decrements the
account balance and marks the item bought. A purchase larger than the chosen
account's balance is blocked outright. One-off budget overspends and budget
pace warnings are warnings, not blocks. Every purchase shows up in Budgets,
categories and the ledger as a normal expense.

### Wishlist via AI assistants (MCP)

When the MCP endpoint is enabled, assistants can manage the wishlist through
`get_wishlist` (items with computed state, summary and suggestion),
`add_wishlist_item` / `update_wishlist_item` (direct writes — metadata only,
never the ledger), and two-level confirmation for everything else:
`stage_wishlist_purchase` and `stage_wishlist_item_delete` must be approved
with `confirm_action(token)`, exactly like transactions and deletes. Purchases
run the same atomic balance check as the web app; cooling-off items additionally
require the user's explicit approval and are staged with
`acknowledgeCooling=true`. `update_settings` / `get_settings` also expose the
wishlist keys (`wishlistCushion`, `wishlistIncomeOverride`,
`wishlistCoolingDays`, `wishlistExcludedCategories`); pass `""` or `null` to
clear the runway and income override.

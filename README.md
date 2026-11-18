# birrwise

A Next.js finance dashboard for tracking budgets, accounts, categories, and transactions with Prisma & PostgreSQL.

## Features

- Dashboard with balances, budgets, and spending breakdowns
- Transactions, accounts, categories, and rules management
- CSV import / export
- SMS webhook (`POST /api/webhooks/sms`) that parses bank alerts and records transactions
- Basic Auth for the dashboard and API; the SMS webhook uses its own `X-API-Key`

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

If `APP_USERNAME` and `APP_PASSWORD` are unset in local development, Basic Auth
is disabled. Set both in `.env` to test the login prompt locally.

## Deploy to Vercel

The production app runs at **https://birrwise-ten.vercel.app** from
`Merisola/birrwise` (`main`). The Vercel project is connected to the repository,
so pushes to `main` deploy automatically.

1. Keep the existing Neon/Postgres database connected to the project. The build
   uses `DATABASE_URL`; if the project also provides `DATABASE_URL_UNPOOLED`
   and you add `directUrl` to `prisma/schema.prisma`, point it there.
2. Set these Vercel environment variables **before** deploying the version that
   enables Basic Auth:
   - `SMS_WEBHOOK_API_KEY` — the same key used by MacroDroid
   - `APP_USERNAME` and `APP_PASSWORD` — dashboard/API login
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

The webhook is excluded from Basic Auth and still requires `X-API-Key`. Never
commit `.env` or production credentials.

# birrwise

A Next.js finance dashboard for tracking budgets, accounts, categories, and transactions with Prisma & PostgreSQL.

## Features

- Dashboard with balances, budgets, and spending breakdowns
- Transactions, accounts, categories, and rules management
- CSV import / export
- SMS webhook (`POST /api/webhooks/sms`) that parses bank alerts and records transactions

## Tech stack

- Next.js 14 (App Router) + React + Tailwind CSS
- Prisma + PostgreSQL

## Local setup

```bash
npm install
cp .env.example .env   # then fill in a real DATABASE_URL + SMS_WEBHOOK_API_KEY
npm run db:push
npm run db:seed
npm run dev
```

## Deploy to Vercel

1. Push the repo to GitHub (done — `Merisola/birrwise`).
2. Go to https://vercel.com/new and import the repository.
3. Create a Postgres database (Vercel Postgres, Neon, or Supabase) and add its connection string as `DATABASE_URL` in **Project Settings → Environment Variables**.
4. Add `SMS_WEBHOOK_API_KEY` (any long random string) as another environment variable.
5. Deploy. The build script runs `prisma generate && prisma db push && next build`, so the schema is created automatically.
6. (Optional) Seed demo data against the production DB, or use the in-app **Settings → Reset** endpoint.

The SMS webhook is live at `https://<your-domain>/api/webhooks/sms` and expects an `X-API-Key` header matching `SMS_WEBHOOK_API_KEY`.

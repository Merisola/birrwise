/**
 * One-off script to inspect & clean duplicate externalRef values.
 * Run ONCE against the production DB before the next deploy that adds @unique.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-external-ref.ts --dry-run   # just show duplicates
 *   npx tsx scripts/cleanup-duplicate-external-ref.ts --apply     # actually nullify rn > 1
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY;

// Safety: refuse to run against SQLite (local dev DB)
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith('file:')) {
  console.error('❌ Refusing to run: DATABASE_URL points to SQLite (file:).');
  console.error('This script is for PostgreSQL production DB only.');
  console.error('Set DATABASE_URL to your production Postgres URL and try again.');
  process.exit(1);
}

async function main() {
  console.log(DRY_RUN ? '[DRY RUN]' : '[APPLY]');

  // 1️⃣ Show all duplicates with full row details
  const dupGroups = await prisma.$queryRaw<Array<{
    externalRef: string;
    count: bigint;
    ids: string;
    names: string;
    createdAts: string;
  }>>`
    SELECT
      "externalRef",
      COUNT(*) AS count,
      STRING_AGG("id"::text, ',' ORDER BY "id" ASC) AS ids,
      STRING_AGG("name", ' | ' ORDER BY "id" ASC) AS names,
      STRING_AGG("createdAt"::text, ',' ORDER BY "id" ASC) AS createdAts
    FROM "Transaction"
    WHERE "externalRef" IS NOT NULL
    GROUP BY "externalRef"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  if (dupGroups.length === 0) {
    console.log('✅ No duplicate externalRef values found. Nothing to clean.');
    return;
  }

  console.log(`\nFound ${dupGroups.length} externalRef value(s) with duplicates:\n`);
  for (const g of dupGroups) {
    console.log(`  externalRef: ${g.externalRef}`);
    console.log(`    count: ${g.count}`);
    console.log(`    ids:     ${g.ids}`);
    console.log(`    names:   ${g.names}`);
    console.log(`    created: ${g.createdAts}`);
    console.log('');
  }

  if (DRY_RUN) {
    console.log('--- DRY RUN COMPLETE ---');
    console.log('Run with --apply to nullify all but the first row (by id ASC) per externalRef.');
    return;
  }

  // 2️⃣ Apply: keep row #1 per externalRef, set externalRef = NULL on rn > 1
  const result = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT
        id,
        "externalRef",
        ROW_NUMBER() OVER (PARTITION BY "externalRef" ORDER BY id ASC) AS rn
      FROM "Transaction"
      WHERE "externalRef" IS NOT NULL
    )
    UPDATE "Transaction"
    SET "externalRef" = NULL
    FROM ranked
    WHERE "Transaction".id = ranked.id
      AND ranked.rn > 1
  `;

  console.log(`✅ Nullified externalRef on ${result} row(s).`);
  console.log('The unique constraint can now be added safely.');

  // 3️⃣ Verify
  const remaining = await prisma.$queryRaw<Array<{ externalRef: string; count: bigint }>>`
    SELECT "externalRef", COUNT(*) AS count
    FROM "Transaction"
    WHERE "externalRef" IS NOT NULL
    GROUP BY "externalRef"
    HAVING COUNT(*) > 1
  `;

  if (remaining.length === 0) {
    console.log('✅ Verification passed: no duplicates remain.');
  } else {
    console.warn('⚠️  Duplicates still present after cleanup:');
    console.table(remaining);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
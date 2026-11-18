import { prisma } from '@/lib/prisma';

/**
 * Create (or update) a categorization rule and back-fill matching
 * uncategorized expense transactions — same behavior as the web UI.
 */
export async function createRuleWithBackfill(keyword: string, category: string) {
  const keyUpper = keyword.trim().toUpperCase();
  if (!keyUpper || !category) {
    throw new Error('Keyword and category are required');
  }

  const rule = await prisma.rule.upsert({
    where: { keyword: keyUpper },
    update: { category },
    create: { keyword: keyUpper, category },
  });

  const matching = await prisma.transaction.findMany({
    where: { category: 'Uncategorized', type: 'expense' },
  });

  let updatedCount = 0;
  for (const t of matching) {
    if (t.name.toUpperCase().includes(keyUpper)) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { category },
      });
      updatedCount++;
    }
  }

  return { rule, updatedCount };
}

/**
 * Server-side pay-cycle utilities.
 * Reads the `cycleStartDay` setting (default 7, clamped 1-28).
 */

import { prisma } from '@/lib/prisma';

/** Fetch the cycleStartDay setting, defaults to 7, clamped to 1-28. */
export async function getCycleStartDay(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'cycleStartDay' } });
  const parsed = Number(row?.value);
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.min(28, Math.floor(parsed));
}

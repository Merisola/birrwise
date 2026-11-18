import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Upsert the common category set (from the local seed) into the database.
 * Existing categories are never modified; only missing ones are created.
 * Safe to call repeatedly.
 */
const COMMON = [
  { name: 'Income', icon: '↗' },
  { name: 'Transport', icon: '🚕' },
  { name: 'Coffee & snacks', icon: '☕' },
  { name: 'Food & groceries', icon: '🛍' },
  { name: 'Bills', icon: '🏠' },
  { name: 'Personal', icon: '✦' },
  { name: 'Internal transfer', icon: '⇄' },
  { name: 'Uncategorized', icon: '◉' },
] as const;

export async function POST() {
  try {
    const existing = await prisma.category.findMany({ select: { name: true } });
    const have = new Set(existing.map((c) => c.name.toLowerCase()));

    const added: string[] = [];
    for (const c of COMMON) {
      if (have.has(c.name.toLowerCase())) continue;
      await prisma.category.create({ data: { ...c } });
      added.push(c.name);
    }

    return NextResponse.json({ ok: true, added, skipped: COMMON.length - added.length });
  } catch (error) {
    console.error('Error loading common categories:', error);
    return NextResponse.json(
      { error: 'Failed to load common categories' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

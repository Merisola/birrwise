import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { category, always } = await request.json();

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: { category },
      include: { account: true, toAccount: true },
    });

    let rulesCount = 0;
    if (always) {
      const keyword = existing.name.toUpperCase();
      await prisma.rule.upsert({
        where: { keyword },
        update: { category },
        create: { keyword, category },
      });

      // Update all uncategorized expenses matching this keyword
      const allUncategorized = await prisma.transaction.findMany({
        where: {
          category: 'Uncategorized',
          type: 'expense',
        },
      });

      for (const t of allUncategorized) {
        if (t.name.toUpperCase().includes(keyword)) {
          await prisma.transaction.update({
            where: { id: t.id },
            data: { category },
          });
          rulesCount++;
        }
      }
    }

    return NextResponse.json({
      transaction: {
        ...updated,
        date: updated.date.toISOString().slice(0, 10),
      },
      similarUpdated: rulesCount,
    });
  } catch (error) {
    console.error('Error setting category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rules = await prisma.rule.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, category } = await request.json();

    if (!keyword || !keyword.trim() || !category) {
      return NextResponse.json(
        { error: 'Keyword and category are required' },
        { status: 400 }
      );
    }

    const keyUpper = keyword.trim().toUpperCase();

    const rule = await prisma.rule.upsert({
      where: { keyword: keyUpper },
      update: { category },
      create: { keyword: keyUpper, category },
    });

    // Update matching uncategorized transactions
    const matching = await prisma.transaction.findMany({
      where: {
        category: 'Uncategorized',
        type: 'expense',
      },
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

    return NextResponse.json({ rule, updatedCount });
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}

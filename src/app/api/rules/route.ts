import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRuleWithBackfill } from '@/lib/rules';

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

    const { rule, updatedCount } = await createRuleWithBackfill(keyword, category);

    return NextResponse.json({ rule, updatedCount });
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

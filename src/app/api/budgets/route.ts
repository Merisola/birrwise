import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { monthBounds, monthProgress, monthLabel } from '@/lib/dates';
import {
  buildBudgetsWithSpending,
  computeBudgetSummary,
  computeBudgetPace,
} from '@/lib/budgets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || monthBounds().month;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM.' },
        { status: 400 }
      );
    }

    const budgets = await prisma.budget.findMany({
      orderBy: { createdAt: 'asc' },
    });
    // Serialize to the client Budget shape (string dates)
    const budgetList = budgets.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    const bounds = monthBounds(month);

    const [transactions, allCategories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          date: { gte: bounds.start, lte: bounds.end },
          type: 'expense',
        },
        select: { category: true, amount: true, type: true },
      }),
      prisma.category.findMany({ select: { name: true, parentId: true, id: true } }),
    ]);

    // Roll subcategories up into their main categories for budget matching.
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    const childrenOf: Record<string, string[]> = {};
    for (const c of allCategories) {
      if (c.parentId) {
        const parent = byId.get(c.parentId);
        if (parent) {
          (childrenOf[parent.name] ||= []).push(c.name);
        }
      }
    }

    const prog = monthProgress(month);
    const budgetsWithSpending = buildBudgetsWithSpending(budgetList, transactions, month, childrenOf);
    const summary = computeBudgetSummary(budgetsWithSpending);
    const pace = computeBudgetPace(summary, prog);

    return NextResponse.json({
      budgets: budgetsWithSpending,
      summary,
      pace,
      monthLabel: monthLabel(month),
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { category, limit, icon, color } = await request.json();

    if (!category || !limit || limit <= 0) {
      return NextResponse.json(
        { error: 'Valid category and limit are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.budget.findUnique({
      where: { category },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A budget already exists for this category.' },
        { status: 400 }
      );
    }

    const icons: Record<string, string> = {
      Transport: '🚕',
      'Food & coffee': '☕',
      Bills: '🏠',
      Personal: '🛍',
      Health: '💊',
      Other: '✦',
    };

    const created = await prisma.budget.create({
      data: {
        category,
        limit: Number(limit),
        icon: icon || icons[category] || '✦',
        color: color || '#7255d9',
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating budget:', error);
    return NextResponse.json(
      { error: 'Failed to create budget' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';

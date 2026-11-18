import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const categoryIcons: Record<string, string> = {};
    categories.forEach((c) => {
      categoryIcons[c.name] = c.icon;
    });

    return NextResponse.json({
      categories,
      categoryIcons,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, icon, parentId } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmed = name.trim();

    // Optional parent: must exist and be a top-level (main) category.
    let parent = null;
    if (parentId) {
      parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found.' },
          { status: 400 }
        );
      }
      if (parent.parentId) {
        return NextResponse.json(
          { error: 'Categories can only be two levels deep.' },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.category.findUnique({
      where: { name: trimmed },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'That category already exists' },
        { status: 400 }
      );
    }

    const created = await prisma.category.create({
      data: {
        name: trimmed,
        icon: (icon || parent?.icon || '✦').trim(),
        parentId: parent?.id ?? null,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

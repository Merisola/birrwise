import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { name, icon, parentId } = await request.json();

    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Optional re-parenting (omit the field to leave it unchanged; null clears it)
    let resolvedParentId: string | null | undefined = undefined;
    if (parentId !== undefined) {
      if (parentId === null) {
        resolvedParentId = null; // move to root
      } else {
        if (parentId === id) {
          return NextResponse.json(
            { error: 'A category cannot be its own parent.' },
            { status: 400 }
          );
        }
        const parent = await prisma.category.findUnique({
          where: { id: parentId },
        });
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
        // A main category that has children cannot become a subcategory.
        const childCount = await prisma.category.count({
          where: { parentId: id },
        });
        if (childCount > 0) {
          return NextResponse.json(
            { error: 'A category with subcategories cannot become a subcategory.' },
            { status: 400 }
          );
        }
        resolvedParentId = parent.id;
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(icon ? { icon: icon.trim() } : {}),
        ...(resolvedParentId !== undefined ? { parentId: resolvedParentId } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const systemCats = ['Income', 'Internal transfer', 'Uncategorized'];
    if (systemCats.includes(existing.name)) {
      return NextResponse.json(
        { error: 'This system category cannot be removed.' },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

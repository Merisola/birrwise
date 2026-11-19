import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeItem, validateItemInput } from '@/lib/wishlistIO';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const existing = await prisma.wishlistItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Wishlist item not found.' }, { status: 404 });
    }
    if (existing.status === 'purchased') {
      return NextResponse.json(
        { error: 'Purchased items cannot be edited — this keeps your history truthful.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    const data = validateItemInput(body, { partial: true });
    if ('error' in data) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    if (Object.keys(data.value).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    const updated = await prisma.wishlistItem.update({
      where: { id },
      data: data.value,
    });
    return NextResponse.json(serializeItem(updated));
  } catch (error) {
    console.error('Error updating wishlist item:', error);
    return NextResponse.json({ error: 'Failed to update wishlist item' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const existing = await prisma.wishlistItem.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Wishlist item not found.' }, { status: 404 });
    }
    // Deleting a wishlist item never deletes its purchase transaction.
    await prisma.wishlistItem.delete({ where: { id } });
    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error('Error deleting wishlist item:', error);
    return NextResponse.json({ error: 'Failed to delete wishlist item' }, { status: 500 });
  }
}

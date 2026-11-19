import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildWishlistData } from '@/lib/wishlist';
import { serializeComputed, serializeItem, validateItemInput } from '@/lib/wishlistIO';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await buildWishlistData(new Date());
    return NextResponse.json({
      items: data.items.map(serializeComputed),
      purchased: data.purchased.map(serializeItem),
      summary: data.summary,
      suggestion: data.suggestion,
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validateItemInput(body, { partial: false });
    if ('error' in data) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }
    const v = data.value;
    const created = await prisma.wishlistItem.create({
      data: {
        name: v.name!,
        price: v.price!,
        priority: v.priority ?? 2,
        category: v.category ?? null,
        note: v.note ?? null,
        url: v.url ?? null,
      },
    });
    return NextResponse.json(serializeItem(created), { status: 201 });
  } catch (error) {
    console.error('Error creating wishlist item:', error);
    return NextResponse.json({ error: 'Failed to create wishlist item' }, { status: 500 });
  }
}

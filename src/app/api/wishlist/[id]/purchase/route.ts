import { NextRequest, NextResponse } from 'next/server';
import { purchaseWishlistItem, WishlistPurchaseError } from '@/lib/wishlist';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const raw = (body ?? {}) as Record<string, unknown>;
    const account = String(raw.account ?? '').trim();
    if (!account) {
      return NextResponse.json({ error: 'Choose an account to buy from.' }, { status: 400 });
    }
    const category = raw.category == null ? undefined : String(raw.category).trim() || undefined;
    const acknowledgeCooling = raw.acknowledgeCooling === true;

    const result = await purchaseWishlistItem({ id, account, category, acknowledgeCooling });
    return NextResponse.json({
      ok: true,
      item: {
        id: result.item.id,
        transactionId: result.item.transactionId,
        purchasedAt: result.item.purchasedAt?.toISOString() ?? null,
      },
      transaction: {
        id: result.transaction.id,
        name: result.transaction.name,
        amount: result.transaction.amount,
        category: result.transaction.category,
        account: result.transaction.account.short,
      },
      account: {
        id: result.account.id,
        short: result.account.short,
        balanceBefore: result.account.balanceBefore,
        balanceAfter: result.account.balanceAfter,
      },
    });
  } catch (error) {
    if (error instanceof WishlistPurchaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Error purchasing wishlist item:', error);
    return NextResponse.json({ error: 'Failed to complete the purchase.' }, { status: 500 });
  }
}

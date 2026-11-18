import { NextRequest, NextResponse } from 'next/server';
import {
  updateTransactionRecord,
  deleteTransactionRecord,
  TransactionInputError,
  NotFoundError,
} from '@/lib/transactions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Web API surface is intentionally narrower than the internal lib:
    // date/type/account edits are not exposed here.
    const updated = await updateTransactionRecord(id, {
      ...(body.category ? { category: body.category } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.amount ? { amount: Number(body.amount) } : {}),
      ...(body.time ? { time: body.time } : {}),
      ...(body.icon ? { icon: body.icon } : {}),
    });

    return NextResponse.json({
      ...updated,
      date: updated.date.toISOString().slice(0, 10),
    });
  } catch (error) {
    if (error instanceof TransactionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
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
    await deleteTransactionRecord(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

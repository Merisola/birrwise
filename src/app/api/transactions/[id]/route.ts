import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const existing = await prisma.transaction.findUnique({
      where: { id },
      include: { account: true, toAccount: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(body.category ? { category: body.category } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.label !== undefined
          ? { label: body.label ? String(body.label).trim().slice(0, 140) : null }
          : {}),
        ...(body.name ? { name: body.name } : {}),
        ...(body.amount ? { amount: Number(body.amount) } : {}),
        ...(body.time ? { time: body.time } : {}),
        ...(body.icon ? { icon: body.icon } : {}),
      },
      include: {
        account: true,
        toAccount: true,
      },
    });

    return NextResponse.json({
      ...updated,
      date: updated.date.toISOString().slice(0, 10),
    });
  } catch (error) {
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

    const existing = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Reverse balance effect
      if (existing.type === 'expense') {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: existing.amount } },
        });
      } else if (existing.type === 'income') {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { decrement: existing.amount } },
        });
      } else if (existing.type === 'transfer') {
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: existing.amount } },
        });
        if (existing.toAccountId) {
          await tx.account.update({
            where: { id: existing.toAccountId },
            data: { balance: { decrement: existing.amount } },
          });
        }
      }

      await tx.transaction.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

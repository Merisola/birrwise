import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return NextResponse.json({
      accounts,
      totalBalance,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, balance } = body;
    let { short, icon } = body;

    if (!name || balance === undefined || balance < 0) {
      return NextResponse.json(
        { error: 'Valid name and non-negative balance are required' },
        { status: 400 }
      );
    }

    if (!short) {
      short = name.length > 9 ? name.slice(0, 8).toUpperCase() : name.toUpperCase();
    }

    // Ensure short is unique
    let uniqueShort = short;
    let counter = 1;
    while (await prisma.account.findUnique({ where: { short: uniqueShort } })) {
      uniqueShort = `${short.slice(0, 6)}_${counter++}`;
    }

    if (!icon) {
      icon =
        type === 'Cash wallet'
          ? '₿'
          : type === 'Mobile wallet'
          ? 'M'
          : 'B';
    }

    const created = await prisma.account.create({
      data: {
        name: name.trim(),
        short: uniqueShort,
        type: type || 'Bank account',
        balance: Number(balance) || 0,
        icon,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

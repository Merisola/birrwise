import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SETTINGS_RESET !== 'true'
  ) {
    return NextResponse.json(
      { error: 'The demo reset endpoint is disabled in production.' },
      { status: 403 }
    );
  }

  try {
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.rule.deleteMany();
    await prisma.category.deleteMany();
    await prisma.account.deleteMany();
    await prisma.setting.deleteMany();

    const accountsData = [
      { name: 'Bank of Abyssinia', short: 'BOA', type: 'Bank account', balance: 12450, icon: 'BOA' },
      { name: 'Commercial Bank of Ethiopia', short: 'CBE', type: 'Bank account', balance: 8200, icon: 'CBE' },
      { name: 'Telebirr', short: 'Telebirr', type: 'Mobile wallet', balance: 5300, icon: 'T' },
      { name: 'Cash wallet', short: 'Cash', type: 'Cash wallet', balance: 2500, icon: '₿' },
    ];

    const createdAccounts: Record<string, string> = {};
    for (const acc of accountsData) {
      const created = await prisma.account.create({ data: acc });
      createdAccounts[acc.short] = created.id;
    }

    const categoriesData = [
      { name: 'Income', icon: '↗' },
      { name: 'Transport', icon: '🚕' },
      { name: 'Coffee & snacks', icon: '☕' },
      { name: 'Food & groceries', icon: '🛍' },
      { name: 'Bills', icon: '🏠' },
      { name: 'Personal', icon: '✦' },
      { name: 'Internal transfer', icon: '⇄' },
      { name: 'Uncategorized', icon: '◉' },
    ];
    for (const cat of categoriesData) {
      await prisma.category.create({ data: cat });
    }

    const budgetsData = [
      { category: 'Transport', icon: '🚕', limit: 3000, color: '#7255d9' },
      { category: 'Food & coffee', icon: '☕', limit: 3500, color: '#7255d9' },
      { category: 'Bills', icon: '🏠', limit: 4000, color: '#6d9cce' },
      { category: 'Personal', icon: '🛍', limit: 2000, color: '#59a88a' },
    ];
    for (const b of budgetsData) {
      await prisma.budget.create({ data: b });
    }

    const rulesData = [
      { keyword: 'TOMOCA', category: 'Coffee & snacks' },
      { keyword: 'RIDE', category: 'Transport' },
      { keyword: 'ELECTRICITY', category: 'Bills' },
    ];
    for (const r of rulesData) {
      await prisma.rule.create({ data: r });
    }

    const settingsData = [
      { key: 'workspace', value: 'My workspace' },
      { key: 'currency', value: 'ETB' },
      { key: 'dateFormat', value: 'DD/MM/YYYY' },
      { key: 'budget80', value: 'true' },
      { key: 'budget100', value: 'true' },
      { key: 'review', value: 'true' },
    ];
    for (const s of settingsData) {
      await prisma.setting.create({ data: s });
    }

    // Generate demo dates relative to today so the reset demo always shows
    // current-month data.
    const daysAgo = (n: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const rawTx = [
      { date: daysAgo(0), time: '10:42 AM', account: 'Telebirr', name: 'Tomoca Coffee', category: 'Coffee & snacks', type: 'expense', amount: 85, icon: '☕', note: 'Coffee payment' },
      { date: daysAgo(0), time: '8:15 AM', account: 'Telebirr', name: 'Ride payment', category: 'Transport', type: 'expense', amount: 70, icon: '🚕', note: 'Morning commute' },
      { date: daysAgo(1), time: '11:00 AM', account: 'Telebirr', name: 'Taxi ride', category: 'Transport', type: 'expense', amount: 80, icon: '🚕', note: 'Weekend ride' },
      { date: daysAgo(2), time: '9:02 AM', account: 'BOA', name: 'Monthly salary', category: 'Income', type: 'income', amount: 46000, icon: '↗', note: 'Salary credit' },
      { date: daysAgo(2), time: '2:30 PM', account: 'CBE', name: 'POS purchase', category: 'Uncategorized', type: 'expense', amount: 420, icon: '🛍', note: 'Card payment' },
      { date: daysAgo(3), time: '6:18 PM', account: 'Telebirr', name: 'Unknown recipient', category: 'Uncategorized', type: 'expense', amount: 250, icon: '◉', note: 'Telebirr transfer' },
      { date: daysAgo(3), time: '3:40 PM', account: 'Telebirr', name: 'Transfer to 0911…', category: 'Uncategorized', type: 'expense', amount: 300, icon: '◉', note: 'Telebirr transfer' },
      { date: daysAgo(3), time: '11:04 AM', account: 'BOA', name: 'ATM withdrawal', category: 'Internal transfer', type: 'transfer', amount: 1000, icon: '▤', note: 'Moved to physical cash', toAccount: 'Cash' },
      { date: daysAgo(4), time: '1:10 PM', account: 'Cash', name: 'Lunch', category: 'Food & groceries', type: 'expense', amount: 180, icon: '🍽', note: 'Cash purchase' },
      { date: daysAgo(5), time: '4:00 PM', account: 'CBE', name: 'Clothing', category: 'Personal', type: 'expense', amount: 650, icon: '🛍', note: 'Card payment' },
      { date: daysAgo(7), time: '5:30 PM', account: 'CBE', name: 'Supermarket', category: 'Food & groceries', type: 'expense', amount: 620, icon: '🛒', note: 'Household shopping' },
      { date: daysAgo(8), time: '10:20 AM', account: 'CBE', name: 'Electricity bill', category: 'Bills', type: 'expense', amount: 650, icon: '💡', note: 'Monthly utility' },
      { date: daysAgo(9), time: '9:00 AM', account: 'CBE', name: 'Internet bill', category: 'Bills', type: 'expense', amount: 1450, icon: '📶', note: 'Monthly utility' },
      { date: daysAgo(10), time: '9:15 AM', account: 'Telebirr', name: 'Coffee', category: 'Coffee & snacks', type: 'expense', amount: 50, icon: '☕', note: 'Cafe payment' },
      { date: daysAgo(11), time: '11:00 AM', account: 'CBE', name: 'Water bill', category: 'Bills', type: 'expense', amount: 700, icon: '💧', note: 'Monthly utility' },
      { date: daysAgo(13), time: '4:20 PM', account: 'BOA', name: 'Self transfer', category: 'Internal transfer', type: 'transfer', amount: 500, icon: '⇄', note: 'BOA to Telebirr', toAccount: 'Telebirr' },
      { date: daysAgo(19), time: '3:05 PM', account: 'Cash', name: 'Personal purchase', category: 'Personal', type: 'expense', amount: 350, icon: '🛍', note: 'Cash purchase' },
    ];

    for (const t of rawTx) {
      const accountId = createdAccounts[t.account];
      if (!accountId) continue;
      const toAccountId = t.toAccount ? createdAccounts[t.toAccount] : null;

      await prisma.transaction.create({
        data: {
          date: new Date(`${t.date}T12:00:00Z`),
          time: t.time,
          accountId,
          toAccountId,
          name: t.name,
          category: t.category,
          type: t.type,
          amount: t.amount,
          icon: t.icon,
          note: t.note,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    return NextResponse.json({ error: 'Failed to reset demo data' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

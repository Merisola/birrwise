import { NextRequest, NextResponse } from 'next/server';
import { parseImportFile } from '@/lib/import';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let csvText = '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      csvText = await file.text();
    } else {
      const body = await request.json();
      csvText = body.csvText || '';
    }

    // Load rules for categorization
    const rules = await prisma.rule.findMany();

    // Load existing transactions for duplicate detection
    const existingTx = await prisma.transaction.findMany({
      select: { date: true, time: true, name: true, amount: true, accountId: true, type: true },
    });

    // Get account short names for fingerprint matching
    const accounts = await prisma.account.findMany({ select: { id: true, short: true } });
    const accountShortMap = new Map(accounts.map(a => [a.id, a.short]));

    const existingForDedupe = existingTx.map(t => ({
      date: t.date.toISOString().slice(0, 10),
      time: t.time,
      name: t.name,
      amount: t.amount,
      account: accountShortMap.get(t.accountId) || '',
      type: t.type,
    }));

    const result = parseImportFile(csvText, {
      dateFormat: 'DD/MM/YYYY',
      existingTransactions: existingForDedupe,
      rules: rules.map(r => ({ keyword: r.keyword, category: r.category })),
    });

    return NextResponse.json({
      preview: result.rows.slice(0, 20),
      validRows: result.rows,
      validCount: result.rows.length,
      errors: result.errors,
      stats: result.stats,
      duplicates: result.duplicates,
    });
  } catch (error) {
    console.error('Error parsing CSV import:', error);
    return NextResponse.json(
      { error: 'Failed to parse CSV' },
      { status: 500 }
    );
  }
}
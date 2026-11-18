import { Account, Transaction, TransactionType } from '@/types';
import { csvCell } from './utils';

export function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"' && quoted) {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export interface ParsedCSVRow {
  date: string;
  name: string;
  note: string;
  amount: number;
  account: string;
  category: string;
  type: TransactionType;
  icon: string;
}

export function parseCSV(text: string): {
  valid: ParsedCSVRow[];
  errors: string[];
} {
  const lines = text.split(/\r?\n/).filter((x) => x.trim());
  if (lines.length < 2) {
    return { valid: [], errors: ['The CSV has no transaction rows.'] };
  }

  const headers = parseCSVLine(lines[0]).map((x) => x.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);

  const required = ['date', 'description', 'amount'];
  const missing = required.filter((k) => idx(k) < 0);
  if (missing.length > 0) {
    return {
      valid: [],
      errors: ['CSV needs date, description and amount columns.'],
    };
  }

  const valid: ParsedCSVRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const c = parseCSVLine(lines[i]);
    const rawAmt = (c[idx('amount')] || '').replace(/[^0-9.-]/g, '');
    const amountNum = Number(rawAmt);
    const date = c[idx('date')] || '';
    const name = c[idx('description')] || '';

    if (!date || !name || !Number.isFinite(amountNum)) {
      errors.push(`Row ${i + 1} has invalid date, description, or amount.`);
      continue;
    }

    const typeIdx = idx('type');
    const rawType =
      typeIdx >= 0
        ? (c[typeIdx] || '').toLowerCase()
        : amountNum >= 0
        ? 'income'
        : 'expense';

    const type: TransactionType =
      rawType === 'income' || rawType === 'transfer' ? rawType : 'expense';

    const account = idx('account') >= 0 ? c[idx('account')] || 'Cash' : 'Cash';
    const category =
      idx('category') >= 0 ? c[idx('category')] || 'Uncategorized' : 'Uncategorized';

    valid.push({
      date,
      name,
      note: 'Imported from CSV',
      amount: Math.abs(amountNum),
      account,
      category,
      type,
      icon: '⇄',
    });
  }

  return { valid, errors };
}

/**
 * Sanitize cell value for CSV to prevent formula injection
 * Prefixes values starting with =, +, -, @ with a single quote
 */
function sanitizeCell(value: string): string {
  if (/^[@=+\-]/.test(value.trim())) {
    return "'" + value;
  }
  return value;
}

/**
 * Generate CSV with UTF-8 BOM and CRLF line endings for Excel compatibility
 */
function generateCSV(headers: string[], rows: string[][]): string {
  const bom = '\uFEFF';
  const headerRow = headers.map(h => csvCell(sanitizeCell(h))).join(',');
  const dataRows = rows.map(r => r.map(v => csvCell(sanitizeCell(v))).join(',')).join('\r\n');
  return bom + headerRow + '\r\n' + dataRows;
}

export function generateTransactionsCSV(transactions: Transaction[]): string {
  const headers = ['date', 'description', 'amount', 'account', 'category', 'type', 'time', 'note', 'label'];
  const rows = transactions.map((t) => {
    const acct =
      typeof t.account === 'string'
        ? t.account
        : t.account?.short || t.account?.name || 'Cash';
    // Amount is always positive; the type column carries the direction.
    // This keeps numeric cells free of leading '-' so formula-injection
    // sanitization never corrupts legitimate amounts.
    const amt = Math.abs(t.amount);
    return [
      t.date ? t.date.slice(0, 10) : '',
      t.name,
      String(amt),
      acct,
      t.category,
      t.type,
      t.time || '',
      t.note || '',
      t.label || '',
    ];
  });

  return generateCSV(headers, rows);
}

export function generateAccountsCSV(accounts: Account[]): string {
  const headers = ['account', 'type', 'balance_etb'];
  const rows = accounts.map((a) => [a.name, a.type, String(a.balance)]);

  return generateCSV(headers, rows);
}
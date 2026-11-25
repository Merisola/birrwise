import { ParsedCSVRow, parseCSVLine } from './csv';
import { TransactionType, Account } from '@/types';
import { suggestCategory } from './categorization';

/**
 * Supported import file types
 */
export type ImportFileType = 'standard' | 'debit-credit' | 'sms-backup' | 'text-dump';

export interface ImportRow {
  date: string;           // ISO YYYY-MM-DD
  time: string;           // HH:MM AM/PM
  name: string;           // description/merchant
  amount: number;         // positive number
  type: TransactionType;  // 'income' | 'expense' | 'transfer'
  account: string;        // account short name or name
  category: string;       // category name or 'Uncategorized'
  note: string;           // additional notes
  icon?: string;          // optional icon override
  source: ImportFileType;
  rowNumber: number;      // original row number for error reporting
  availableBalance?: number;  // set when the SMS states the balance (e.g. BOA)
  transferDirection?: 'in' | 'out';  // only for type 'transfer': which way money moved
  toAccount?: string;     // destination account short name (manual transfers)
  transferGroupId?: string;  // links the two account-side rows of one transfer
  feeAmount?: number;     // bank fee split from a transfer principal
  externalRef?: string;   // bank/wallet transaction reference
}

export interface ImportPreviewResult {
  rows: ImportRow[];
  errors: ImportError[];
  stats: ImportStats;
  duplicates: ImportRow[];  // rows that match existing transactions
}

export interface ImportError {
  rowNumber: number;
  message: string;
  rawValues: string[];
}

export interface ImportStats {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
}

/**
 * Normalize a date string to ISO YYYY-MM-DD
 * Handles: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, Excel serial dates
 */
export function normalizeDate(dateStr: string, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Excel serial date (number of days since 1900-01-01)
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 60000) {
    // Excel epoch is 1900-01-01 (but incorrectly treats 1900 as leap year)
    const excelEpoch = new Date(1900, 0, -1); // -1 to adjust for 1900 leap year bug
    const jsDate = new Date(excelEpoch.getTime() + asNumber * 86400000);
    return jsDate.toISOString().slice(0, 10);
  }

  // Try DD/MM/YYYY or MM/DD/YYYY
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4 && c.length <= 2) {
      // YYYY-MM-DD or YYYY/DD/MM
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
    if (dateFormat === 'DD/MM/YYYY') {
      // DD/MM/YYYY
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    } else {
      // MM/DD/YYYY
      return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
  }

  // Try parsing with Date constructor as fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Normalize amount string to positive number
 * Handles: currency symbols, commas, parentheses for negatives, debit/credit columns
 */
export function normalizeAmount(
  amountStr: string,
  typeStr?: string,
  debitStr?: string,
  creditStr?: string
): { amount: number; type: TransactionType } | null {
  // If debit/credit columns are provided, use them
  if (debitStr !== undefined && creditStr !== undefined) {
    const debit = Number((debitStr || '').replace(/[^0-9.-]/g, ''));
    const credit = Number((creditStr || '').replace(/[^0-9.-]/g, ''));
    if (!isNaN(debit) && debit > 0) {
      return { amount: debit, type: 'expense' };
    }
    if (!isNaN(credit) && credit > 0) {
      return { amount: credit, type: 'income' };
    }
  }

  // Otherwise parse single amount column
  const cleaned = (amountStr || '').replace(/[^0-9.-]/g, '');
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;

  // Check for parentheses indicating negative
  const isParenNegative = /^\(.*\)$/.test(amountStr.trim());
  const absAmount = Math.abs(amount);

  // Determine type from type column or amount sign
  let type: TransactionType = 'expense';
  if (typeStr) {
    const t = typeStr.toLowerCase().trim();
    if (['income', 'credit', 'cr', 'deposit'].includes(t)) type = 'income';
    else if (['transfer', 'xfer'].includes(t)) type = 'transfer';
    else type = 'expense';
  } else if (isParenNegative || amount < 0) {
    type = 'expense';
  } else {
    type = 'income';
  }

  return { amount: absAmount, type };
}

/**
 * Parse time string to HH:MM AM/PM format
 */
export function normalizeTime(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (!trimmed) return '12:00 PM';

  // Already in HH:MM AM/PM format
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Try 24-hour format HH:MM or HH:MM:SS
  const match24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const min = match24[2];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min} ${ampm}`;
  }

  return '12:00 PM';
}

/** Map a bank name from an SMS body to the account short name we use. */
function bankShortName(value: string): string {
  const v = value.trim();
  if (/abyssinia|\bboa\b/i.test(v)) return 'BOA';
  if (/commercial bank of ethiopia|\bcbe\b/i.test(v)) return 'CBE';
  if (/telebirr/i.test(v)) return 'Telebirr';
  return v;
}

/**
 * Detect import file type from headers
 */
export function detectFileType(headers: string[]): ImportFileType {
  const lower = headers.map(h => h.toLowerCase().trim());
  const hasDebit = lower.some(h => h.includes('debit') || h === 'withdrawal');
  const hasCredit = lower.some(h => h.includes('credit') || h === 'deposit');
  const hasBody = lower.some(h => h === 'body' || h === 'message' || h === 'subject');
  const hasAddress = lower.some(h => h === 'address' || h === 'sender' || h === 'from');
  const hasReadableDate = lower.some(h => h.includes('readable') && h.includes('date'));

  if (hasBody && hasAddress && hasReadableDate) return 'sms-backup';
  if (hasDebit && hasCredit) return 'debit-credit';
  if (hasBody || hasAddress) return 'text-dump';
  return 'standard';
}

/**
 * Parse SMS body to extract transaction details
 */
export function parseSMSBody(
  body: string,
  address: string,
  readableDate: string,
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
): Partial<ImportRow> | null {
  const text = body.trim();
  if (!text) return null;

  // Normalize the fallback date up front so an unparseable body-date can
  // still fall back cleanly to the caller-provided timestamp.
  const fallbackDate = normalizeDate(readableDate, dateFormat) || undefined;

  // Telebirr patterns
  // "You have paid ETB 70.00 to Ride payment on 16/11/2026 08:15 AM."
  // "You have received ETB 85.00 from Tomoca Coffee on 16/11/2026 10:42 AM."
  // "You have received ETB 5.00 by transaction number DKI3C9GR1N on
  //  2026-11-18 12:46:02 from Bank of Abyssinia to your telebirr Account
  //  251966125639 - … Your current balance is ETB 4,121.57."
  // Whitespace runs vary between messages — tolerate them everywhere.
  // Bank-to-telebirr pulls carry a transaction number and current balance.
  const telebirrBankPull =
    /You have received\s+ETB\s*([\d,]+\.?\d*)\s+by\s+transaction\s+number\s+([A-Z0-9]+)\s+on\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s+from\s+(.+?)\s+to\s+your\s+telebirr\s+Account/i.exec(text);

  if (telebirrBankPull) {
    const amount = Number(telebirrBankPull[1].replace(/,/g, ''));
    const trx = telebirrBankPull[2].trim();
    const date = normalizeDate(telebirrBankPull[3].trim(), dateFormat) || fallbackDate;
    const time = normalizeTime(telebirrBankPull[4].trim());
    const source = telebirrBankPull[5].trim();
    const balanceMatch = /current balance is\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const availableBalance = balanceMatch
      ? Number(balanceMatch[1].replace(/,/g, ''))
      : undefined;
    const note = [
      `trx ${trx} (from ${source})`,
      availableBalance !== undefined
        ? `Available balance ETB ${availableBalance.toFixed(2)}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      date: date || fallbackDate,
      time,
      // Own-account movement — show which bank the money came from.
      name: `Transfer from ${bankShortName(source)}`,
      amount,
      // Your own money moving between your own accounts — a transfer, not income.
      type: 'transfer',
      transferDirection: 'in',
      account: 'Telebirr',
      category: 'Internal transfer',
      note,
      availableBalance,
      externalRef: trx,
    };
  }

  const telebirrPaid = /You have paid\s+ETB\s*([\d,]+\.?\d*)\s+to\s+([^.]+)\s+on\s+([^.]+)\./i.exec(text);
  const telebirrReceived = /You have received\s+ETB\s*([\d,]+\.?\d*)\s+from\s+([^.]+)\s+on\s+([^.]+)\./i.exec(text);

  if (telebirrPaid) {
    const amount = Number(telebirrPaid[1].replace(/,/g, ''));
    const name = telebirrPaid[2].trim();
    const dateTime = telebirrPaid[3].trim();
    const datePart = dateTime.split(' ')[0];
    const timePart = dateTime.split(' ').slice(1).join(' ');
    return {
      date: normalizeDate(datePart, dateFormat) || fallbackDate,
      time: normalizeTime(timePart),
      name,
      amount,
      type: 'expense',
      account: 'Telebirr',
      category: 'Uncategorized',
      note: 'Parsed from SMS',
    };
  }

  if (telebirrReceived) {
    const amount = Number(telebirrReceived[1].replace(/,/g, ''));
    const name = telebirrReceived[2].trim();
    const dateTime = telebirrReceived[3].trim();
    const datePart = dateTime.split(' ')[0];
    const timePart = dateTime.split(' ').slice(1).join(' ');
    return {
      date: normalizeDate(datePart, dateFormat) || fallbackDate,
      time: normalizeTime(timePart),
      name,
      amount,
      type: 'income',
      account: 'Telebirr',
      category: 'Income',
      note: 'Parsed from SMS',
    };
  }

  // Telebirr outgoing transfer:
  // "You have transferred ETB 5.00 to Milion Kalayu (2519****0513) on
  //  18/11/2026 08:39:06. ... The service fee is ETB 0.87 and 15% VAT on the
  //  service fee is ETB 0.13."
  // Record the total outflow (transfer + fee + VAT) as one expense so the
  // account balance matches the SMS; keep the breakdown in the note.
  const telebirrTransferred =
    /You have transferred\s+ETB\s*([\d,]+\.?\d*)\s+to\s+([^(]+?)\s*(?:\(([^)]*)\))?\s+on\s+([^.]+)\./i.exec(text);

  if (telebirrTransferred) {
    const transferAmount = Number(telebirrTransferred[1].replace(/,/g, ''));
    const name = telebirrTransferred[2].trim();
    const phone = telebirrTransferred[3]?.trim();
    const dateTime = telebirrTransferred[4].trim();
    const datePart = dateTime.split(' ')[0];
    const timePart = dateTime.split(' ').slice(1).join(' ');

    const serviceFeeMatch = /The service fee is\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const vatMatch = /VAT on the service fee is\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const serviceFee = serviceFeeMatch ? Number(serviceFeeMatch[1].replace(/,/g, '')) : 0;
    const vat = vatMatch ? Number(vatMatch[1].replace(/,/g, '')) : 0;
    // Round to cents to avoid floating-point noise.
    const amount = Math.round((transferAmount + serviceFee + vat) * 100) / 100;

    // Transaction number + the balance stated by the SMS. The balance lets the
    // webhook self-correct drift; the transaction number aids reconciliation.
    const trxMatch = /Your transaction number is\s+([A-Z0-9]+)/i.exec(text);
    const trx = trxMatch?.[1]?.trim();
    const balanceMatch = /current(?:\s+E-Money Account)?\s+balance is\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const availableBalance = balanceMatch
      ? Number(balanceMatch[1].replace(/,/g, ''))
      : undefined;

    const breakdown =
      serviceFee || vat
        ? `Transfer ETB ${transferAmount.toFixed(2)} + fee ETB ${serviceFee.toFixed(2)} + VAT ETB ${vat.toFixed(2)}`
        : `Transfer ETB ${transferAmount.toFixed(2)}`;

    const note = [
      trx ? `trx ${trx}` : undefined,
      `${breakdown}${phone ? `; to ${phone}` : ''}`,
      availableBalance !== undefined
        ? `Available balance ETB ${availableBalance.toFixed(2)}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      date: normalizeDate(datePart, dateFormat) || fallbackDate,
      time: normalizeTime(timePart),
      name,
      amount,
      type: 'expense',
      account: 'Telebirr',
      category: 'Uncategorized',
      note,
      availableBalance,
      externalRef: trx,
    };
  }

  // BOA (Bank of Abyssinia):
  // "Dear Meron, your account 1*****64 was debited with ETB 17.00.
  //  Available Balance: ETB 41,802.85. Receipt: .../slip/?trx=FT263226N81J48564 ..."
  // No date inside the body, so the caller-provided timestamp supplies it.
  // The SMS includes an available balance — the webhook prefers to set the
  // account balance absolutely instead of applying an increment.
  const boaAddressHint = /boa|abyssinia/i.test(address);
  const boaTextHint = /bank of abyssinia|bankofabyssinia\.com/i.test(text);
  const boaTxn = boaAddressHint || boaTextHint
    ? /your account[^.\n]*?\bwas\s+(debited|credited)\s+with\s+ETB\s*([\d,]+\.?\d*)/i.exec(text)
    : null;

  if (boaTxn) {
    const amount = Number(boaTxn[2].replace(/,/g, ''));
    const isDebit = boaTxn[1].toLowerCase() === 'debited';
    const balanceMatch = /available balance[:\s]*ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const availableBalance = balanceMatch
      ? Number(balanceMatch[1].replace(/,/g, ''))
      : undefined;
    const trxMatch = /trx=([A-Z0-9]+)/i.exec(text);
    const trx = trxMatch?.[1];
    const note = [
      trx ? `trx ${trx}` : undefined,
      availableBalance !== undefined
        ? `Available balance ETB ${availableBalance.toFixed(2)}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      date: fallbackDate,
      // Empty string means "no time in the body" — the webhook falls back to
      // the payload timestamp's time.
      time: '',
      name: isDebit ? 'BOA debit' : 'BOA credit',
      amount,
      type: isDebit ? 'expense' : 'income',
      account: 'BOA',
      category: isDebit ? 'Uncategorized' : 'Income',
      note: note || 'Parsed from SMS',
      availableBalance,
      externalRef: trx,
    };
  }

  // CBE (Commercial Bank of Ethiopia):
  // "Dear Meron Solomon Tsegay You have successfully transferred ETB 650.00
  //  from account 1********7897 to account 1********2434 (Teklay Zereabruk
  //  Hagos). Service charge of ETB 0.50 and VAT(15%) of ETB 0.08 and
  //  Disaster Recovery(5%) of 0.03 with total of ETB 650.61. Your current
  //  balance is ETB 19.48. Thanks for Banking with CBE. https://mbreciept.
  //  cbe.com.et/v2-…"
  // No date inside the body — the caller-provided timestamp supplies it.
  // The ledger records the TOTAL debited (650.61), like other fee-inclusive
  // SMS; the fee split is kept in the note. `availableBalance` is set the
  // same way as BOA — the webhook applies it absolutely.
  const cbeTextHint = /\bcbe\b|cbe\.com\.et|commercial bank of ethiopia/i.test(text);
  const cbeTransfer = cbeTextHint
    ? /successfully\s+transferred\s+ETB\s*([\d,]+\.?\d*)\s+from\s+account\s+([*\d\w]+)\s+to\s+account\s+([*\d\w]+)(?:\s*\(([^)]*)\))?/i.exec(text)
    : null;

  if (cbeTransfer) {
    const transferAmt = Number(cbeTransfer[1].replace(/,/g, ''));
    const fromMask = cbeTransfer[2];
    const toMask = cbeTransfer[3];
    const recipient = (cbeTransfer[4] || '').trim();
    const fee = (re: RegExp) => {
      const m = re.exec(text);
      return m ? Number(m[1].replace(/,/g, '')) : 0;
    };
    const charge = fee(/service\s+charge\s+of\s+ETB\s*([\d,]+\.?\d*)/i);
    const vat = fee(/VAT\s*(?:\([^)]*\))?\s*of\s+ETB\s*([\d,]+\.?\d*)/i);
    // "Disaster Recovery(5%) of 0.03" — the ETB unit is often missing here.
    const dr = fee(/Disaster\s+Recovery\s*(?:\([^)]*\))?\s*of\s*(?:ETB\s*)?([\d,]+\.?\d*)/i);
    const totalMatch = /with\s+total\s+of\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const amount = totalMatch
      ? Number(totalMatch[1].replace(/,/g, ''))
      : Math.round((transferAmt + charge + vat + dr) * 100) / 100;
    const balanceMatch = /current\s+balance\s+is\s+ETB\s*([\d,]+\.?\d*)/i.exec(text);
    const availableBalance = balanceMatch
      ? Number(balanceMatch[1].replace(/,/g, ''))
      : undefined;
    const receiptMatch = /mbreciept\.cbe\.com\.et\/([^\s]+)/i.exec(text);
    // Strip sentence punctuation that may follow the URL in the SMS body.
    const receipt = receiptMatch?.[1]?.replace(/[.,;)]+$/, '');
    const feeParts = [
      charge ? `charge ETB ${charge.toFixed(2)}` : undefined,
      vat ? `VAT ETB ${vat.toFixed(2)}` : undefined,
      dr ? `DR ETB ${dr.toFixed(2)}` : undefined,
    ].filter(Boolean).join(' + ');
    const note = [
      feeParts ? `Transfer ETB ${transferAmt.toFixed(2)} + ${feeParts}` : `Transfer ETB ${transferAmt.toFixed(2)}`,
      receipt ? `trx ${receipt}` : undefined,
      recipient ? `To ${recipient}` : undefined,
      `From acct ${fromMask} → ${toMask}`,
      availableBalance !== undefined
        ? `Available balance ETB ${availableBalance.toFixed(2)}`
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      date: fallbackDate,
      time: '', // No time in the body — webhook falls back to payload time.
      name: recipient || 'CBE transfer',
      amount,
      // Payee is a third party (per recipient name) — a payment, not an
      // internal transfer and not income.
      type: 'expense',
      account: 'CBE',
      category: 'Uncategorized',
      note,
      availableBalance,
      externalRef: receipt,
    };
  }

  // Generic bank SMS: "Your account has been debited with ETB 420.00. Ref: POS purchase. 16/11/2026 14:30 PM."
  const genericDebit = /account has been debited with ETB\s*([\d,]+\.?\d*)\.?\s*Ref:\s*([^.]+)\.\s*([^.]+)\./i.exec(text);
  const genericCredit = /account has been credited with ETB\s*([\d,]+\.?\d*)\.?\s*Ref:\s*([^.]+)\.\s*([^.]+)\./i.exec(text);

  if (genericDebit) {
    const amount = Number(genericDebit[1].replace(/,/g, ''));
    const name = genericDebit[2].trim();
    const dateTime = genericDebit[3].trim();
    const datePart = dateTime.split(' ')[0];
    const timePart = dateTime.split(' ').slice(1).join(' ');
    return {
      date: normalizeDate(datePart, dateFormat) || fallbackDate,
      time: normalizeTime(timePart),
      name,
      amount,
      type: 'expense',
      account: guessAccountFromAddress(address),
      category: 'Uncategorized',
      note: 'Parsed from SMS',
    };
  }

  if (genericCredit) {
    const amount = Number(genericCredit[1].replace(/,/g, ''));
    const name = genericCredit[2].trim();
    const dateTime = genericCredit[3].trim();
    const datePart = dateTime.split(' ')[0];
    const timePart = dateTime.split(' ').slice(1).join(' ');
    return {
      date: normalizeDate(datePart, dateFormat) || fallbackDate,
      time: normalizeTime(timePart),
      name,
      amount,
      type: 'income',
      account: guessAccountFromAddress(address),
      category: 'Income',
      note: 'Parsed from SMS',
    };
  }

  return null;
}

/**
 * Carrier-assigned shortcodes for banks/wallets (sender ID can't be matched
 * by text). Keys must be lowercase, exact sender strings.
 */
export const KNOWN_SENDER_IDS: Record<string, string> = {
  '127': 'Telebirr', // Telebirr (short message service center / sender ID)
};

/**
 * Guess account from sender address
 */
export function guessAccountFromAddress(address: string): string {
  const addr = address.toLowerCase().trim();
  if (KNOWN_SENDER_IDS[addr]) return KNOWN_SENDER_IDS[addr];
  if (addr.includes('telebirr') || addr === 'telebirr') return 'Telebirr';
  if (addr.includes('cbe') || addr.includes('commercial bank')) return 'CBE';
  if (addr.includes('boa') || addr.includes('abyssinia')) return 'BOA';
  return 'Cash';
}

/**
 * Parse a standard finance CSV row
 */
function parseStandardRow(
  columns: string[],
  headers: string[],
  rowNum: number,
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD',
  rules: Array<{ keyword: string; category: string }>
): ImportRow | null {
  const get = (key: string) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase());
    return idx >= 0 ? columns[idx] : '';
  };

  const date = normalizeDate(get('date') || get('transaction date') || get('readable_date'), dateFormat);
  const name = get('description') || get('narration') || get('details') || get('name') || '';
  const amountResult = normalizeAmount(
    get('amount'),
    get('type'),
    get('debit') || get('withdrawal'),
    get('credit') || get('deposit')
  );
  const time = normalizeTime(get('time') || get('transaction time'));
  const account = get('account') || get('account name') || get('address') || 'Cash';
  const type = amountResult?.type || (get('type')?.toLowerCase().includes('income') ? 'income' : 'expense');
  const amount = amountResult?.amount || 0;

  if (!date || !name || amount <= 0) return null;

  let category = get('category') || get('type') || 'Uncategorized';
  if (category === 'Uncategorized' && type === 'expense') {
    category = suggestCategory(name, rules) || 'Uncategorized';
  } else if (type === 'income') {
    category = 'Income';
  } else if (type === 'transfer') {
    category = 'Internal transfer';
  }

  return {
    date,
    time,
    name,
    amount,
    type,
    account,
    category,
    note: get('note') || 'Imported from CSV',
    source: 'standard',
    rowNumber: rowNum,
  };
}

/**
 * Parse SMS backup CSV row (SMS Backup & Restore format)
 */
function parseSMSBackupRow(
  columns: string[],
  headers: string[],
  rowNum: number,
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD',
  rules: Array<{ keyword: string; category: string }>
): ImportRow | null {
  const get = (key: string) => {
    const idx = headers.findIndex(h => h.toLowerCase().trim() === key.toLowerCase());
    return idx >= 0 ? columns[idx] : '';
  };

  const address = get('address') || get('sender') || get('from') || '';
  const body = get('body') || get('message') || get('subject') || '';
  const readableDate = get('readable_date') || get('date') || '';

  const parsed = parseSMSBody(body, address, readableDate, dateFormat);
  if (!parsed) return null;

  let category = parsed.category || 'Uncategorized';
  if (category === 'Uncategorized' && parsed.type === 'expense') {
    category = suggestCategory(parsed.name || '', rules) || 'Uncategorized';
  }

  return {
    date: parsed.date || '',
    time: parsed.time || '12:00 PM',
    name: parsed.name || 'Unknown',
    amount: parsed.amount || 0,
    type: parsed.type || 'expense',
    account: parsed.account || 'Cash',
    category,
    note: parsed.note || 'Parsed from SMS',
    source: 'sms-backup',
    rowNumber: rowNum,
  };
}

/**
 * Main import parser - detects file type and parses accordingly
 */
export function parseImportFile(
  text: string,
  options: {
    dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    existingTransactions?: Array<{ date: string; time: string; name: string; amount: number; account: string; type: string }>;
    rules?: Array<{ keyword: string; category: string }>;
  } = {}
): ImportPreviewResult {
  const { dateFormat = 'DD/MM/YYYY', existingTransactions = [], rules = [] } = options;

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: 'The CSV has no transaction rows.', rawValues: [] }],
      stats: { total: 0, valid: 0, invalid: 0, duplicates: 0 },
      duplicates: [],
    };
  }

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const fileType = detectFileType(headers);

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  const duplicates: ImportRow[] = [];

  // Build fingerprint set for duplicate detection
  const existingFingerprints = new Set(
    existingTransactions.map(t =>
      `${t.date}|${t.time}|${t.name.toLowerCase().trim()}|${t.amount.toFixed(2)}|${t.account.toLowerCase()}|${t.type}`
    )
  );
  const batchFingerprints = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const columns = parseCSVLine(lines[i]);

    let row: ImportRow | null = null;

    try {
      if (fileType === 'sms-backup') {
        row = parseSMSBackupRow(columns, headers, rowNum, dateFormat, rules);
      } else if (fileType === 'debit-credit') {
        row = parseStandardRow(columns, headers, rowNum, dateFormat, rules);
      } else {
        row = parseStandardRow(columns, headers, rowNum, dateFormat, rules);
      }
    } catch (e) {
      errors.push({
        rowNumber: rowNum,
        message: e instanceof Error ? e.message : 'Parse error',
        rawValues: columns,
      });
      continue;
    }

    if (!row) {
      errors.push({
        rowNumber: rowNum,
        message: 'Row has invalid date, description, or amount.',
        rawValues: columns,
      });
      continue;
    }

    // Check for duplicates
    const fingerprint = `${row.date}|${row.time}|${row.name.toLowerCase().trim()}|${row.amount.toFixed(2)}|${row.account.toLowerCase()}|${row.type}`;
    if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
      duplicates.push(row);
      continue;
    }

    batchFingerprints.add(fingerprint);
    rows.push(row);
  }

  return {
    rows,
    errors,
    stats: {
      total: lines.length - 1,
      valid: rows.length,
      invalid: errors.length,
      duplicates: duplicates.length,
    },
    duplicates,
  };
}
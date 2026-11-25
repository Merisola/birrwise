/**
 * Bank of Abyssinia receipt enrichment.
 *
 * BOA debit/credit SMS alerts carry no counterparty name — only a receipt link.
 * The receipt page is a small SPA backed by an undocumented JSON endpoint, so
 * this module is deliberately conservative:
 *
 *   - only the exact `cs.bankofabyssinia.com` host is ever contacted
 *   - the reference must look like a BOA `FT…` token
 *   - a short timeout is enforced
 *   - every failure returns null, and the caller keeps the generic
 *     "BOA debit" / "BOA credit" fallback
 */

const BOA_RECEIPT_API = 'https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/';
const BOA_RECEIPT_LINK =
  /https?:\/\/cs\.bankofabyssinia\.com\/slip\/\?trx=([A-Za-z0-9]+)/i;
const BOA_REF_RE = /^FT[A-Z0-9]{8,24}$/;

const FETCH_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;

export interface BoaReceipt {
  ref: string;
  transactionType?: string;
  transactionRef?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM AM/PM
  transferredAmount?: number;
  serviceCharge?: number;
  vat?: number;
  totalAmount?: number;
  receiverName?: string;
  receiverAccount?: string;
  receiverBank?: string;
  payerName?: string;
  sourceAccountName?: string;
  sourceAccount?: string;
  paymentReference?: string;
  narrative?: string;
}

export interface BoaEnrichmentOptions {
  /** Amount stated by the SMS (the total debit/credit). */
  smsAmount: number;
  isDebit: boolean;
  /** Parser's generic label, used when the receipt has no usable name. */
  fallbackName: string;
}

export interface BoaEnrichment {
  name: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  transferDirection?: 'in' | 'out';
  /** Amount that actually moved between the accounts (excludes fees). */
  principalAmount: number;
  /** Fee/VAT/other charges debited on top of the principal. */
  feeAmount: number;
  note: string;
  date?: string;
  time?: string;
  externalRef: string;
  isTelebirr: boolean;
}

const cache = new Map<string, { at: number; value: BoaReceipt | null }>();

/** Extract a strictly-validated BOA receipt reference from an SMS body. */
export function extractBoaReceiptRef(message: string): string | null {
  const match = BOA_RECEIPT_LINK.exec(message);
  if (!match) return null;
  const ref = match[1].trim().toUpperCase();
  return BOA_REF_RE.test(ref) ? ref : null;
}

export function isBoaReceiptRef(value: string): boolean {
  return BOA_REF_RE.test(value);
}

/** Fetch and defensively parse a BOA receipt. Never throws. */
export async function fetchBoaReceipt(ref: string): Promise<BoaReceipt | null> {
  const normalized = ref.trim().toUpperCase();
  if (!isBoaReceiptRef(normalized)) return null;

  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  let receipt: BoaReceipt | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL(BOA_RECEIPT_API);
    url.searchParams.set('id', normalized);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const body =
      json && typeof json === 'object' && Array.isArray((json as { body?: unknown }).body)
        ? (json as { body: unknown[] }).body
        : [];
    const row = body[0];
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;

    const record = row as Record<string, unknown>;
    const parsedDate = parseBoaDate(str(record['Transaction Date']));

    receipt = {
      ref: normalized,
      transactionType: str(record['Transaction Type']),
      transactionRef: str(record['Transaction Reference']),
      date: parsedDate?.date,
      time: parsedDate?.time,
      transferredAmount: num(record['Transferred Amount']),
      serviceCharge: num(record['Service Charge']),
      vat: num(record['VAT (15%)']),
      totalAmount: num(record['Total Amount including VAT']),
      receiverName: str(record["Receiver's Name"]),
      receiverAccount: str(record["Receiver's Account"]),
      receiverBank: str(record['Bank name']),
      payerName: str(record["Payer's Name"]),
      sourceAccountName: str(record['Source Account Name']),
      sourceAccount: str(record['Source Account']),
      paymentReference: str(record['Payment Reference']),
      narrative: str(record['Narrative']),
    };
  } catch {
    receipt = null;
  } finally {
    clearTimeout(timer);
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(normalized, { at: Date.now(), value: receipt });
  }

  return receipt;
}

export function isTelebirrReceipt(receipt: BoaReceipt): boolean {
  return /telebirr/i.test(receipt.transactionType || '');
}

/**
 * Turn a receipt into the fields the ledger needs. The SMS amount stays the
 * source of truth for the total; the receipt supplies the counterparty and,
 * for Telebirr pulls, the principal/fee split.
 */
export function buildBoaEnrichment(
  receipt: BoaReceipt,
  opts: BoaEnrichmentOptions
): BoaEnrichment {
  const isTelebirr = isTelebirrReceipt(receipt);
  const principalAmount =
    opts.isDebit && isTelebirr && receipt.transferredAmount !== undefined
      ? round(receipt.transferredAmount)
      : round(opts.smsAmount);
  const feeAmount =
    opts.isDebit && isTelebirr
      ? round(Math.max(0, opts.smsAmount - principalAmount))
      : 0;

  const name = isTelebirr
    ? opts.isDebit
      ? 'Transfer to Telebirr'
      : 'Transfer from Telebirr'
    : opts.isDebit
    ? titleCase(receipt.receiverName) || opts.fallbackName
    : titleCase(receipt.payerName) ||
      titleCase(receipt.sourceAccountName) ||
      opts.fallbackName;

  const type: BoaEnrichment['type'] = isTelebirr
    ? 'transfer'
    : opts.isDebit
    ? 'expense'
    : 'income';
  const category = isTelebirr
    ? 'Internal transfer'
    : opts.isDebit
    ? 'Uncategorized'
    : 'Income';

  const noteParts = [`trx ${receipt.ref}`];
  if (receipt.receiverName) noteParts.push(`To ${titleCase(receipt.receiverName)}`);
  if (receipt.payerName) noteParts.push(`From ${titleCase(receipt.payerName)}`);
  if (receipt.receiverBank) noteParts.push(`Bank ${receipt.receiverBank}`);
  if (receipt.transactionType) noteParts.push(`Type ${receipt.transactionType}`);
  if (receipt.narrative) noteParts.push(receipt.narrative);

  if (isTelebirr) {
    noteParts.push(`Principal ETB ${money(principalAmount)}`);
    if (receipt.serviceCharge !== undefined) {
      noteParts.push(`Service charge ETB ${money(receipt.serviceCharge)}`);
    }
    if (receipt.vat !== undefined) noteParts.push(`VAT ETB ${money(receipt.vat)}`);
    if (feeAmount > 0) noteParts.push(`Fee ETB ${money(feeAmount)}`);
    if (receipt.paymentReference) {
      noteParts.push(`Telebirr ref ${receipt.paymentReference}`);
    }
  } else if (receipt.transferredAmount !== undefined) {
    noteParts.push(`Transferred ETB ${money(receipt.transferredAmount)}`);
    if (receipt.serviceCharge !== undefined) {
      noteParts.push(`Service charge ETB ${money(receipt.serviceCharge)}`);
    }
    if (receipt.vat !== undefined) noteParts.push(`VAT ETB ${money(receipt.vat)}`);
  }
  if (receipt.totalAmount !== undefined) {
    noteParts.push(`Total ETB ${money(receipt.totalAmount)}`);
  }

  return {
    name,
    type,
    category,
    transferDirection: isTelebirr ? (opts.isDebit ? 'out' : 'in') : undefined,
    principalAmount,
    feeAmount,
    note: noteParts.join(' · '),
    date: receipt.date,
    time: receipt.time,
    externalRef: receipt.ref,
    isTelebirr,
  };
}

/** Note for the separate fee row created alongside a Telebirr transfer. */
export function boaFeeNote(receipt: BoaReceipt, feeAmount: number): string {
  const parts: string[] = [];
  if (receipt.serviceCharge !== undefined) {
    parts.push(`Service charge ETB ${money(receipt.serviceCharge)}`);
  }
  if (receipt.vat !== undefined) parts.push(`VAT ETB ${money(receipt.vat)}`);
  const listed = (receipt.serviceCharge || 0) + (receipt.vat || 0);
  const residual = round(feeAmount - listed);
  if (residual > 0.005) parts.push(`Other charge ETB ${money(residual)}`);
  return `BOA transfer fee · ${parts.join(' + ')} · trx ${receipt.ref}`;
}

export const BOA_TELEBIRR_FEE_NAME = 'Bank fee (BOA → Telebirr)';

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(value: number): string {
  return value.toFixed(2);
}

function titleCase(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function parseBoaDate(value?: string): { date: string; time: string } | null {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: to12Hour(Number(match[4]), Number(match[5])),
  };
}

function to12Hour(hour24: number, minute: number): string {
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

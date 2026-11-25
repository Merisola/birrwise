import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import {
  parseSMSBody,
  guessAccountFromAddress,
  normalizeDate,
  normalizeTime,
} from '@/lib/import';
import {
  BOA_TELEBIRR_FEE_NAME,
  boaFeeNote,
  buildBoaEnrichment,
  extractBoaReceiptRef,
  fetchBoaReceipt,
} from '@/lib/boaReceipt';

/**
 * Shared SMS ingestion used by the live webhook and the manual "Add a missed
 * SMS" flow. Keeping both paths on this module guarantees identical parsing,
 * deduplication and balance behavior.
 */

export interface SmsIngestPayload {
  sender: string;
  message: string;
  timestamp: string;
}

export interface SmsIngestOptions {
  /** Parse and return a preview without writing anything. */
  preview?: boolean;
  /**
   * Apply a balance stated by the SMS absolutely (live messages). Manual
   * backfills pass false so an old SMS never rolls the balance back to a
   * historical value.
   */
  applyAbsoluteBalance?: boolean;
  /** Appended to the transaction note. */
  source?: 'webhook' | 'manual';
}

export interface SmsTransactionPreview {
  date: string;              // YYYY-MM-DD
  time: string;              // HH:MM AM/PM
  name: string;
  amount: number;            // transfer principal, or total for expense/income
  type: 'income' | 'expense' | 'transfer';
  category: string;
  note: string;
  icon: string;
  account: { id: string; short: string; name: string };
  transferDirection?: 'in' | 'out';
  transferGroupId?: string;
  /** Bank fee recorded as a separate expense row (transfers only). */
  feeAmount?: number;
}

export interface SmsPreviewResult extends SmsTransactionPreview {
  balanceBefore: number;
  balanceAfter: number;
  /** Balance stated inside the SMS, when present. */
  smsBalance?: number;
  /** True when the same transaction (fingerprint or semantic match) exists. */
  duplicate: boolean;
  /** Stated balance vs what the app will compute (only when they differ). */
  balanceMismatch?: { expected: number; stated: number };
}

export type SmsIngestResult =
  | { status: 'preview'; preview: SmsPreviewResult }
  | {
      status: 'created';
      transaction: SmsTransactionPreview & { id: string };
      balanceBefore: number;
      balanceAfter: number;
      smsBalance?: number;
      feeTransactionId?: string;
    }
  | { status: 'duplicate' }
  | { status: 'invalid_timestamp'; message: string }
  | { status: 'unparseable'; message: string };

function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T12:00:00Z`).getTime());
}

/** Format an instant as Ethiopia local wall time (Africa/Addis_Ababa). */
function toAddisParts(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = String(parseInt(get('hour'), 10) || 12);
  const minute = get('minute') || '00';
  const ampm = (get('dayPeriod') || '').toUpperCase().replace(/[^A-Z]/g, '');
  return { date, time: normalizeTime(`${hour}:${minute} ${ampm}`) };
}

/**
 * Accept either ISO 8601 (2026-11-17T08:15:00+03:00) or bank-style
 * (17/11/2026 08:15 AM) timestamps. Returns YYYY-MM-DD + normalized time.
 * The timestamp is only a fallback — dates inside the SMS body win.
 */
function parseSmsTimestamp(raw: string): { date: string; time: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Epoch seconds (10 digits) or milliseconds (13 digits) — UTC instant,
  // reported as Ethiopia local wall time.
  if (/^\d{10}$/.test(trimmed)) {
    const d = new Date(Number(trimmed) * 1000);
    if (isNaN(d.getTime())) return null;
    return toAddisParts(d);
  }
  if (/^\d{13}$/.test(trimmed)) {
    const d = new Date(Number(trimmed));
    if (isNaN(d.getTime())) return null;
    return toAddisParts(d);
  }

  // ISO 8601-ish: YYYY-MM-DD(THH:MM[:SS][.fff][Z|±HH:MM])?
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(trimmed);
  if (iso) {
    if (iso[6]) {
      // Explicit offset/Z → instant, report EAT local wall time
      const d = new Date(trimmed.replace(' ', 'T'));
      if (isNaN(d.getTime())) return null;
      return toAddisParts(d);
    }
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    if (!isValidDateString(date)) return null;
    const time = iso[4] ? normalizeTime(`${iso[4]}:${iso[5]}`) : '12:00 PM';
    return { date, time };
  }

  // Bank-style: DD/MM/YYYY[ h:mm AM/PM]
  const bank = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?\s*$/i.exec(trimmed);
  if (bank) {
    const date = normalizeDate(`${bank[1].padStart(2, '0')}/${bank[2].padStart(2, '0')}/${bank[3]}`, 'DD/MM/YYYY');
    if (!date || !isValidDateString(date)) return null;
    const time = bank[4] ? normalizeTime(`${bank[4]}:${bank[5]} ${bank[6] || ''}`) : '12:00 PM';
    return { date, time };
  }

  // Last resort: date-only strings the normalizer understands
  const fallback = normalizeDate(trimmed, 'DD/MM/YYYY');
  if (fallback && isValidDateString(fallback)) return { date: fallback, time: '12:00 PM' };

  return null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Parse a stored "HH:MM AM/PM" time into minutes since midnight. */
function timeToMinutes(value?: string | null): number {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(value || '');
  if (!m) return 0;
  const hour = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(m[2]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Account short named in "Transfer to X" / "Transfer from X". */
function transferCounterparty(name: string, direction: 'in' | 'out'): string | null {
  const re = direction === 'in' ? /^Transfer from\s+(.+)$/i : /^Transfer to\s+(.+)$/i;
  const match = re.exec(name.trim());
  return match?.[1]?.trim() || null;
}

interface TransferSibling {
  id: string;
  name: string;
  transferGroupId: string | null;
}

/**
 * Find the other account's row for the same movement. Only links when there is
 * exactly one plausible candidate, so two similar transfers on the same day
 * are left unlinked instead of being paired incorrectly.
 */
async function findTransferSibling(params: {
  siblingAccountId: string;
  amount: number;
  dateISO: string;
  timeStr: string;
  siblingDirection: 'in' | 'out';
}): Promise<TransferSibling | null> {
  const candidates = await prisma.transaction.findMany({
    where: {
      accountId: params.siblingAccountId,
      type: 'transfer',
      toAccountId: null,
      transferGroupId: null,
      amount: params.amount,
      date: new Date(`${params.dateISO}T12:00:00Z`),
    },
    select: {
      id: true,
      name: true,
      note: true,
      time: true,
      transferDirection: true,
      transferGroupId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const targetMinutes = timeToMinutes(params.timeStr);
  const withinWindow = candidates.filter((candidate) => {
    const directionOk =
      params.siblingDirection === 'in'
        ? candidate.transferDirection !== 'out'
        : candidate.transferDirection !== 'in';
    if (!directionOk) return false;

    // The sibling on the BOA side must already be a Telebirr transfer; this
    // stops us pairing an unrelated BOA payment with the same amount.
    if (params.siblingDirection === 'out') {
      const haystack = `${candidate.name} ${candidate.note || ''}`;
      if (!/telebirr/i.test(haystack)) return false;
    }

    return Math.abs(timeToMinutes(candidate.time) - targetMinutes) <= 15;
  });

  if (withinWindow.length !== 1) return null;
  return withinWindow[0];
}

export async function ingestSms(
  payload: SmsIngestPayload,
  options: SmsIngestOptions = {}
): Promise<SmsIngestResult> {
  const { preview = false, source = 'webhook' } = options;
  const allowAbsoluteBalance = options.applyAbsoluteBalance !== false;

  const parsedTime = parseSmsTimestamp(payload.timestamp);
  if (!parsedTime) {
    return {
      status: 'invalid_timestamp',
      message: 'Unparseable "timestamp". Use ISO 8601 or DD/MM/YYYY h:mm AM/PM.',
    };
  }

  let parsed = parseSMSBody(payload.message, payload.sender, parsedTime.date, 'DD/MM/YYYY');
  if (!parsed) {
    return {
      status: 'unparseable',
      message: 'Could not parse the SMS message as a transaction.',
    };
  }

  // --- BOA receipt enrichment ---
  // The SMS has no counterparty name; the receipt does. Enrichment is strictly
  // best-effort — any failure leaves the parser's generic BOA debit/credit row.
  let boaReceipt = null as Awaited<ReturnType<typeof fetchBoaReceipt>>;
  if (parsed.account === 'BOA') {
    const ref = parsed.externalRef || extractBoaReceiptRef(payload.message);
    if (ref) {
      boaReceipt = await fetchBoaReceipt(ref);
      if (boaReceipt) {
        const enrichment = buildBoaEnrichment(boaReceipt, {
          smsAmount: parsed.amount ?? 0,
          isDebit: parsed.type !== 'income',
          fallbackName:
            parsed.name || (parsed.type === 'income' ? 'BOA credit' : 'BOA debit'),
        });
        parsed = {
          ...parsed,
          date: enrichment.date || parsed.date,
          time: enrichment.time || parsed.time,
          name: enrichment.name,
          type: enrichment.type,
          category: enrichment.category,
          transferDirection: enrichment.transferDirection,
          amount: enrichment.principalAmount,
          note: enrichment.note,
          externalRef: enrichment.externalRef,
          feeAmount: enrichment.feeAmount,
        };
      }
    }
  }

  // --- Account resolution ---
  //   1. guess from sender shortcode/name
  //   2. direct sender match against account short/name
  //   3. trust the SMS body pattern (e.g. Telebirr-format text)
  //   4. fall back to Cash
  // "Cash" from step 1 is the parser's *default*, not a real match, so it
  // must not short-circuit steps 2–3.
  const allAccounts = await prisma.account.findMany();
  const accountMap = new Map<string, (typeof allAccounts)[number]>();
  allAccounts.forEach((a) => {
    accountMap.set(a.short.toLowerCase(), a);
    accountMap.set(a.name.toLowerCase(), a);
  });

  const resolve = (key: string | undefined) =>
    key ? accountMap.get(key.toLowerCase()) : undefined;
  const guessed = guessAccountFromAddress(payload.sender);
  let account = resolve(guessed);
  const isDefaultedCash = (a?: (typeof allAccounts)[number]) =>
    !!a && a.short.toLowerCase() === 'cash';
  if (!account || isDefaultedCash(account)) {
    account = resolve(payload.sender) || resolve(guessed.split(' ')[0]);
  }
  if ((!account || isDefaultedCash(account)) && parsed.account) {
    account = resolve(parsed.account);
  }
  if (!account) {
    account = accountMap.get('cash') || allAccounts[0];
  }
  if (!account) {
    account = await prisma.account.create({
      data: { name: 'Cash wallet', short: 'Cash', type: 'Cash wallet', balance: 0, icon: '₿' },
    });
  }

  // --- Categorize ---
  const rules = await prisma.rule.findMany();
  const type = parsed.type || 'expense';
  let category = parsed.category || 'Uncategorized';
  if (type === 'expense' && (category === 'Uncategorized' || !category)) {
    category = suggestCategory(parsed.name || '', rules) || 'Uncategorized';
  } else if (type === 'income') {
    // Keep parser-assigned categories for these pulls (e.g. 'Internal transfer')
    if (category === 'Uncategorized' || !category) {
      category = 'Income';
    }
  } else if (type === 'transfer') {
    category = 'Internal transfer';
  }

  const dateISO = parsed.date || parsedTime.date;
  const dateObj = new Date(`${dateISO}T12:00:00Z`);
  const timeStr = parsed.time || parsedTime.time;
  const amount = Math.abs(parsed.amount ?? 0);
  const feeAmount = Math.abs(parsed.feeAmount ?? 0);
  const name = parsed.name || 'SMS transaction';
  const transferDirection = parsed.transferDirection;
  const icon = type === 'income' ? '↗' : type === 'transfer' ? '⇄' : '📩';
  const sourceSuffix =
    source === 'manual' ? 'Added manually from SMS' : 'Auto-ingested from SMS webhook';

  const parsedNote =
    parsed.note && parsed.note !== 'Parsed from SMS' ? parsed.note : '';
  const noteWithBalance =
    parsed.availableBalance !== undefined &&
    !/available balance/i.test(parsedNote)
      ? [parsedNote, `Available balance ETB ${parsed.availableBalance.toFixed(2)}`]
          .filter(Boolean)
          .join(' · ')
      : parsedNote;
  const note = noteWithBalance ? `${noteWithBalance} · ${sourceSuffix}` : sourceSuffix;

  // --- Idempotency ---
  // Exact fingerprint of the SMS: protects against MacroDroid retries and
  // concurrent duplicate deliveries. The unique index makes the insert atomic.
  const fingerprint = createHash('sha256')
    .update(`${payload.sender}\n${payload.message}`)
    .digest('hex');

  const exactDuplicate = await prisma.transaction.findUnique({
    where: { fingerprint },
    select: { id: true },
  });

  let duplicate = Boolean(exactDuplicate);

  // Bank reference is the strongest cross-delivery key: it survives whitespace
  // changes and also catches SMSes whose body was already enriched differently.
  if (!duplicate && parsed.externalRef) {
    const byRef = await prisma.transaction.findUnique({
      where: { externalRef: parsed.externalRef },
      select: { id: true },
    });
    duplicate = Boolean(byRef);
  }

  // Secondary semantic check for older transactions that predate fingerprints,
  // or for a retry whose body whitespace changed.
  if (!duplicate) {
    const semanticFingerprint = `${dateISO}|${timeStr}|${name.toLowerCase().trim()}|${amount.toFixed(2)}|${account.id.toLowerCase()}|${type}`;
    const existing = await prisma.transaction.findMany({
      where: { date: dateObj, time: timeStr, name, amount },
      select: { date: true, time: true, name: true, amount: true, accountId: true, type: true },
    });
    duplicate = existing.some(
      (t) =>
        `${t.date.toISOString().slice(0, 10)}|${t.time}|${t.name.toLowerCase().trim()}|${t.amount.toFixed(2)}|${t.accountId.toLowerCase()}|${t.type}` ===
        semanticFingerprint
    );
  }

  // --- Linked two-row transfers ---
  // Each account keeps its own row (auditability), joined by a shared group id.
  // No toAccountId is set, so balances are never applied twice.
  let transferGroupId: string | undefined;
  let siblingId: string | undefined;
  let siblingName = '';
  if (
    type === 'transfer' &&
    (transferDirection === 'in' || transferDirection === 'out')
  ) {
    const counterpartyShort = transferCounterparty(name, transferDirection);
    const siblingAccount = resolve(counterpartyShort || undefined);
    if (siblingAccount && siblingAccount.id !== account.id) {
      const sibling = await findTransferSibling({
        siblingAccountId: siblingAccount.id,
        amount,
        dateISO,
        timeStr,
        siblingDirection: transferDirection === 'in' ? 'out' : 'in',
      });
      if (sibling) {
        transferGroupId = sibling.transferGroupId || randomUUID();
        siblingId = sibling.id;
        siblingName = sibling.name;
      }
    }
  }

  // --- Balance math ---
  const isIncomingTransfer = type === 'transfer' && transferDirection === 'in';
  const delta =
    type === 'income' || isIncomingTransfer
      ? amount
      : type === 'transfer'
      ? -(amount + feeAmount)
      : -amount;
  const smsBalance = parsed.availableBalance;

  // Is this SMS the newest activity on the account? Only then does its stated
  // balance describe the current balance. Older (backfilled) messages get
  // their delta applied but never roll the balance back to a past value.
  let isLatestForAccount = true;
  let applyAbsolute = false;
  if (smsBalance !== undefined) {
    const latest = await prisma.transaction.findFirst({
      where: { accountId: account.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { date: true, time: true },
    });
    if (latest) {
      const latestISO = latest.date.toISOString().slice(0, 10);
      isLatestForAccount =
        dateISO > latestISO ||
        (dateISO === latestISO && timeToMinutes(timeStr) >= timeToMinutes(latest.time));
    }
    applyAbsolute = allowAbsoluteBalance && isLatestForAccount;
  }

  const expectedAfter = Math.round((account.balance + delta) * 100) / 100;
  const balanceAfter =
    applyAbsolute && smsBalance !== undefined
      ? Math.round(smsBalance * 100) / 100
      : expectedAfter;

  const previewData: SmsPreviewResult = {
    date: dateISO,
    time: timeStr,
    name,
    amount,
    type,
    category,
    note,
    icon,
    account: { id: account.id, short: account.short, name: account.name },
    balanceBefore: account.balance,
    balanceAfter,
    duplicate,
    ...(feeAmount > 0 ? { feeAmount } : {}),
    ...(transferDirection ? { transferDirection } : {}),
    ...(transferGroupId ? { transferGroupId } : {}),
    ...(smsBalance !== undefined ? { smsBalance } : {}),
    ...(smsBalance !== undefined &&
    isLatestForAccount &&
    Math.abs(expectedAfter - smsBalance) > 0.005
      ? { balanceMismatch: { expected: expectedAfter, stated: smsBalance } }
      : {}),
  };

  if (preview) {
    return { status: 'preview', preview: previewData };
  }

  if (duplicate) {
    return { status: 'duplicate' };
  }

  // --- Create transaction(s) + adjust balance atomically ---
  const created = await prisma
    .$transaction(async (tx) => {
      // Join the other account's leg before inserting, so the pair is visible
      // immediately on both registers.
      if (siblingId && transferGroupId) {
        // A legacy Telebirr pull is called "Internal transfer"; give it a
        // clear counterparty now that the BOA side is known.
        const renameSibling =
          transferDirection === 'out' &&
          /^(Internal transfer|Transfer from )/i.test(siblingName);
        await tx.transaction.update({
          where: { id: siblingId },
          data: {
            transferGroupId,
            ...(renameSibling
              ? { name: 'Transfer from BOA', transferDirection: 'in' as const }
              : {}),
          },
        });
      }

      await tx.account.update({
        where: { id: account.id },
        data:
          applyAbsolute && smsBalance !== undefined
            ? { balance: smsBalance }
            : { balance: { increment: delta } },
      });

      let feeTransactionId: string | undefined;
      if (type === 'transfer' && feeAmount > 0) {
        const fee = await tx.transaction.create({
          data: {
            date: dateObj,
            time: timeStr,
            accountId: account.id,
            name: BOA_TELEBIRR_FEE_NAME,
            category: 'Uncategorized',
            type: 'expense',
            amount: feeAmount,
            icon: '🧾',
            note: `${
              boaReceipt ? boaFeeNote(boaReceipt, feeAmount) : 'BOA transfer fee'
            } · ${sourceSuffix}`,
            fingerprint: `${fingerprint}:fee`,
            externalRef: parsed.externalRef ? `${parsed.externalRef}:fee` : null,
            transferGroupId: transferGroupId || null,
          },
          select: { id: true },
        });
        feeTransactionId = fee.id;
      }

      const primary = await tx.transaction.create({
        data: {
          date: dateObj,
          time: timeStr,
          accountId: account.id,
          name,
          category,
          type,
          amount,
          icon,
          note,
          fingerprint,
          externalRef: parsed.externalRef || null,
          transferGroupId: transferGroupId || null,
          transferDirection: transferDirection || null,
        },
        select: {
          id: true,
          date: true,
          time: true,
          name: true,
          category: true,
          type: true,
          amount: true,
          note: true,
        },
      });

      return { primary, feeTransactionId };
    })
    .catch((error) => {
      // A concurrent delivery inserted the same fingerprint first. The
      // transaction (including the balance change) was rolled back.
      if (isUniqueConstraintError(error)) return null;
      throw error;
    });

  if (!created) {
    return { status: 'duplicate' };
  }

  const primary = created.primary;
  return {
    status: 'created',
    transaction: {
      id: primary.id,
      date: primary.date.toISOString().slice(0, 10),
      time: primary.time,
      name: primary.name,
      amount: primary.amount,
      type: primary.type as SmsTransactionPreview['type'],
      category: primary.category,
      note: primary.note ?? note,
      icon,
      account: { id: account.id, short: account.short, name: account.name },
      ...(feeAmount > 0 ? { feeAmount } : {}),
      ...(transferDirection ? { transferDirection } : {}),
      ...(transferGroupId ? { transferGroupId } : {}),
    },
    balanceBefore: account.balance,
    balanceAfter,
    ...(smsBalance !== undefined ? { smsBalance } : {}),
    ...(created.feeTransactionId
      ? { feeTransactionId: created.feeTransactionId }
      : {}),
  };
}

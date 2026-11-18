import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import {
  parseSMSBody,
  guessAccountFromAddress,
  normalizeDate,
  normalizeTime,
} from '@/lib/import';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024; // 16 KB — an SMS is tiny
const MAX_SENDER_LEN = 200;
const MAX_MESSAGE_LEN = 5000;

function getConfiguredApiKey(): string | undefined {
  return process.env.SMS_WEBHOOK_API_KEY || process.env['X-API-Key'];
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function duplicateResponse() {
  return NextResponse.json(
    { ok: true, duplicate: true, message: 'Matching transaction already exists; not duplicated.' },
    { status: 200 }
  );
}

/**
 * Real SMS bodies are multi-line and macro tools paste them raw into JSON
 * string literals — the literal \r, \n, \t characters inside strings make the
 * document invalid. Escape raw control bytes that appear INSIDE string
 * literals and retry the parse. Control bytes outside strings are left
 * alone (whitespace is legal JSON).
 */
function lenientJsonParse(raw: string): unknown {
  let inString = false;
  let escaped = false;
  let out = '';
  for (const ch of raw) {
    if (inString) {
      if (escaped) { out += ch; escaped = false; continue; }
      if (ch === '\\') { out += ch; escaped = true; continue; }
      if (ch === '"') { out += ch; inString = false; continue; }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        switch (ch) {
          case '\n': out += '\\n'; break;
          case '\r': out += '\\r'; break;
          case '\t': out += '\\t'; break;
          default: out += '\\u00' + code.toString(16).padStart(2, '0');
        }
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return JSON.parse(out);
}

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
 */
function parseTimestamp(raw: string): { date: string; time: string } | null {
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

interface SmsWebhookPayload {
  sender: string;
  message: string;
  timestamp: string;
}

function validatePayload(body: unknown): { payload?: SmsWebhookPayload; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object.' };
  }
  const { sender, message, timestamp } = body as Record<string, unknown>;

  if (typeof sender !== 'string' || !sender.trim()) {
    return { error: 'Missing or invalid "sender".' };
  }
  if (sender.length > MAX_SENDER_LEN) {
    return { error: '"sender" is too long.' };
  }
  if (typeof message !== 'string' || !message.trim()) {
    return { error: 'Missing or invalid "message".' };
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return { error: '"message" is too long.' };
  }
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') {
    return { error: 'Missing or invalid "timestamp".' };
  }
  const timestampStr =
    typeof timestamp === 'number' && Number.isFinite(timestamp)
      ? String(Math.trunc(timestamp))
      : String(timestamp).trim();

  return { payload: { sender: sender.trim(), message: message.trim(), timestamp: timestampStr } };
}

export async function POST(request: NextRequest) {
  // --- Auth: X-API-Key ---
  const configured = getConfiguredApiKey();
  if (!configured) {
    console.error('SMS webhook called without configured key (set SMS_WEBHOOK_API_KEY or X-API-Key)');
    return NextResponse.json({ error: 'SMS webhook is not configured' }, { status: 503 });
  }

  const provided = request.headers.get('x-api-key') || request.headers.get('X-API-Key') || '';
  if (!provided || !safeEqual(provided, configured)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Body size guard ---
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // --- Payload source: query params, form-encoded body, or JSON ---
  // Query params (?sender=…&message=…&timestamp=…) are ideal for macro tools
  // that can't JSON-escape raw SMS text reliably.
  const url = new URL(request.url);
  const qSender = url.searchParams.get('sender');
  const qMessage = url.searchParams.get('message');
  const qTimestamp = url.searchParams.get('timestamp');

  let candidate: unknown;
  if (qSender !== null || qMessage !== null || qTimestamp !== null) {
    candidate = {
      sender: qSender ?? undefined,
      message: qMessage ?? undefined,
      timestamp: qTimestamp ?? undefined,
    };
  } else if (raw.trim()) {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(raw);
      candidate = {
        sender: params.get('sender') ?? undefined,
        message: params.get('message') ?? undefined,
        timestamp: params.get('timestamp') ?? undefined,
      };
    } else {
      try {
        candidate = JSON.parse(raw);
      } catch {
        try {
          candidate = lenientJsonParse(raw);
        } catch {
          return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
      }
    }
  } else {
    return NextResponse.json(
      { error: 'Missing payload. Send JSON {"sender","message","timestamp"}, form fields, or ?sender=&message=&timestamp=.' },
      { status: 400 }
    );
  }

  const { payload, error: payloadError } = validatePayload(candidate);
  if (!payload) {
    return NextResponse.json({ error: payloadError }, { status: 400 });
  }

  const parsedTime = parseTimestamp(payload.timestamp);
  if (!parsedTime) {
    return NextResponse.json(
      { error: 'Unparseable "timestamp". Use ISO 8601 or DD/MM/YYYY h:mm AM/PM.' },
      { status: 400 }
    );
  }

  // --- Parse the SMS body into a transaction ---
  const parsed = parseSMSBody(payload.message, payload.sender, parsedTime.date, 'DD/MM/YYYY');
  if (!parsed) {
    return NextResponse.json(
      { error: 'Could not parse the SMS message as a transaction.' },
      { status: 422 }
    );
  }

  // Account resolution: guess from sender, then match against known accounts;
  // fall back to Cash.
  const allAccounts = await prisma.account.findMany();
  const accountMap = new Map<string, (typeof allAccounts)[number]>();
  allAccounts.forEach((a) => {
    accountMap.set(a.short.toLowerCase(), a);
    accountMap.set(a.name.toLowerCase(), a);
  });

  // Account resolution:
  //   1. guess from sender shortcode/name
  //   2. direct sender match against account short/name
  //   3. trust the SMS body pattern (e.g. Telebirr-format text)
  //   4. fall back to Cash
  // "Cash" from step 1 is the parser's *default*, not a real match, so it
  // must not short-circuit steps 2–3.
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
    const created = await prisma.account.create({
      data: { name: 'Cash wallet', short: 'Cash', type: 'Cash wallet', balance: 0, icon: '₿' },
    });
    account = created;
  }

  // --- Categorize ---
  const rules = await prisma.rule.findMany();
  let type = parsed.type || 'expense';
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

  const dateObj = new Date(`${parsed.date}T12:00:00Z`);
  const timeStr = parsed.time || parsedTime.time;
  const amount = Math.abs(parsed.amount ?? 0);
  const name = parsed.name || 'SMS transaction';

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
  if (exactDuplicate) {
    return duplicateResponse();
  }

  // Secondary semantic check for older transactions that predate fingerprints,
  // or for a retry whose body whitespace changed.
  const semanticFingerprint = `${parsed.date}|${timeStr}|${name.toLowerCase().trim()}|${amount.toFixed(2)}|${account.id.toLowerCase()}|${type}`;
  const existing = await prisma.transaction.findMany({
    where: {
      date: dateObj,
      time: timeStr,
      name,
      amount,
    },
    select: { date: true, time: true, name: true, amount: true, accountId: true, type: true },
  });

  const duplicate = existing.some(
    (t) =>
      `${t.date.toISOString().slice(0, 10)}|${t.time}|${t.name.toLowerCase().trim()}|${t.amount.toFixed(2)}|${t.accountId.toLowerCase()}|${t.type}` === semanticFingerprint
  );

  if (duplicate) {
    return duplicateResponse();
  }

  // --- Create transaction + adjust balance atomically ---
  const accountId = account.id;
  const delta = type === 'income' ? amount : -amount;
  // When the SMS states an available balance (e.g. Bank of Abyssinia), set the
  // account balance absolutely instead of incrementing — it self-corrects any
  // earlier drift. Last write wins for concurrent balance-bearing SMS.
  const absoluteBalance = parsed.availableBalance;

  const created = await prisma
    .$transaction(async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data:
          absoluteBalance !== undefined
            ? { balance: absoluteBalance }
            : { balance: { increment: delta } },
      });
      return tx.transaction.create({
        data: {
          date: dateObj,
          time: timeStr,
          accountId,
          name,
          category,
          type,
          amount,
          icon: type === 'income' ? '↗' : type === 'transfer' ? '⇄' : '📩',
          note:
            parsed.note && parsed.note !== 'Parsed from SMS'
              ? `${parsed.note} · Auto-ingested from SMS webhook`
              : 'Auto-ingested from SMS webhook',
          fingerprint,
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
    })
    .catch((error) => {
      // A concurrent delivery inserted the same fingerprint first. The
      // transaction (including the balance change) was rolled back.
      if (isUniqueConstraintError(error)) return null;
      throw error;
    });

  if (!created) {
    return duplicateResponse();
  }

  return NextResponse.json(
    {
      ok: true,
      transactionId: created.id,
      date: created.date.toISOString().slice(0, 10),
      time: created.time,
      name: created.name,
      category: created.category,
      type: created.type,
      amount: created.amount,
      account: account.short,
      ...(absoluteBalance !== undefined ? { availableBalance: absoluteBalance } : {}),
    },
    { status: 201 }
  );
}

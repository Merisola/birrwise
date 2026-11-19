import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { ingestSms } from '@/lib/smsIngest';

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

  const result = await ingestSms(payload, {
    applyAbsoluteBalance: true,
    source: 'webhook',
  });

  switch (result.status) {
    case 'invalid_timestamp':
      return NextResponse.json({ error: result.message }, { status: 400 });
    case 'unparseable':
      return NextResponse.json({ error: result.message }, { status: 422 });
    case 'duplicate':
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'Matching transaction already exists; not duplicated.' },
        { status: 200 }
      );
    case 'created': {
      const t = result.transaction;
      return NextResponse.json(
        {
          ok: true,
          transactionId: t.id,
          date: t.date,
          time: t.time,
          name: t.name,
          category: t.category,
          type: t.type,
          amount: t.amount,
          account: t.account.short,
          ...(result.smsBalance !== undefined ? { availableBalance: result.smsBalance } : {}),
        },
        { status: 201 }
      );
    }
  }
}

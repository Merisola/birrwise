import { NextRequest, NextResponse } from 'next/server';
import { ingestSms } from '@/lib/smsIngest';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LEN = 5000;
const MAX_SENDER_LEN = 200;

/**
 * Manual SMS recovery ("Add a missed SMS").
 *
 * Unlike the webhook (X-API-Key), this route is protected by the app session
 * cookie via middleware. It reuses the exact same parser, dedupe and account
 * resolution as the live webhook. `preview: true` returns the parsed result
 * without writing anything.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 });
  }

  const { sender, message, timestamp, preview } = body as Record<string, unknown>;

  if (typeof sender !== 'string' || !sender.trim()) {
    return NextResponse.json({ error: 'Missing or invalid "sender".' }, { status: 400 });
  }
  if (sender.length > MAX_SENDER_LEN) {
    return NextResponse.json({ error: '"sender" is too long.' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Missing or invalid "message".' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: '"message" is too long.' }, { status: 400 });
  }
  const timestampStr =
    typeof timestamp === 'string' && timestamp.trim()
      ? timestamp.trim()
      : new Date().toISOString();

  const result = await ingestSms(
    { sender: sender.trim(), message: message.trim(), timestamp: timestampStr },
    {
      preview: preview === true,
      // Manual backfills only apply their delta — never roll the balance
      // back to a historical value stated in an old SMS.
      applyAbsoluteBalance: false,
      source: 'manual',
    }
  );

  switch (result.status) {
    case 'invalid_timestamp':
      return NextResponse.json({ error: result.message }, { status: 400 });
    case 'unparseable':
      return NextResponse.json({ error: result.message }, { status: 422 });
    case 'duplicate':
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'This SMS is already in your ledger.' },
        { status: 200 }
      );
    case 'preview':
      return NextResponse.json({ ok: true, preview: result.preview });
    case 'created':
      return NextResponse.json(
        {
          ok: true,
          created: result.transaction,
          balanceBefore: result.balanceBefore,
          balanceAfter: result.balanceAfter,
          ...(result.smsBalance !== undefined ? { smsBalance: result.smsBalance } : {}),
        },
        { status: 201 }
      );
  }
}

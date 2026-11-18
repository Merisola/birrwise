import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isAuthConfigured,
  safeEqual,
  sanitizeNext,
} from '@/lib/auth';
import { isSameOrigin } from '@/lib/request';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

type AttemptEntry = { count: number; resetAt: number };

// Per-instance throttle. Serverless instances do not share this map, so it is
// a speed bump rather than a hard global limit.
const attempts = new Map<string, AttemptEntry>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function activeEntry(key: string): AttemptEntry | null {
  const entry = attempts.get(key);
  if (!entry) return null;
  if (entry.resetAt <= Date.now()) {
    attempts.delete(key);
    return null;
  }
  return entry;
}

function isRateLimited(key: string): boolean {
  const entry = activeEntry(key);
  return Boolean(entry && entry.count >= MAX_ATTEMPTS);
}

function recordFailure(key: string): void {
  const entry = activeEntry(key);
  if (entry) {
    entry.count += 1;
  } else {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  }

  if (attempts.size > 500) {
    const now = Date.now();
    attempts.forEach((value, ip) => {
      if (value.resetAt <= now) attempts.delete(ip);
    });
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function error(message: string, status: number): NextResponse {
  return noStore(NextResponse.json({ error: message }, { status }));
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return error('Invalid request origin.', 403);
  }

  if (!isAuthConfigured()) {
    return error('Authentication is not configured.', 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('Invalid request body.', 400);
  }

  if (typeof body !== 'object' || body === null) {
    return error('Invalid request body.', 400);
  }

  const data = body as { username?: unknown; password?: unknown; next?: unknown };
  const username = typeof data.username === 'string' ? data.username : '';
  const password = typeof data.password === 'string' ? data.password : '';
  const next = sanitizeNext(data.next);

  if (!username || !password) {
    return error('Username and password are required.', 400);
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return noStore(
      NextResponse.json(
        { error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(WINDOW_MS / 1000) } }
      )
    );
  }

  const usernameOk = safeEqual(username, process.env.APP_USERNAME || '');
  const passwordOk = safeEqual(password, process.env.APP_PASSWORD || '');

  if (!usernameOk || !passwordOk) {
    recordFailure(ip);
    return error('Invalid username or password.', 401);
  }

  attempts.delete(ip);

  const token = await createSessionToken(process.env.APP_USERNAME || '');
  if (!token) {
    return error('Authentication is not configured.', 503);
  }

  const response = NextResponse.json({ ok: true, next });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return noStore(response);
}

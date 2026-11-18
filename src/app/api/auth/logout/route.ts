import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { isSameOrigin } from '@/lib/request';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    const response = NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403 }
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

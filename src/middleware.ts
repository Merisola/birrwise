import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  isAuthConfigured,
  verifySessionToken,
} from '@/lib/auth';

/**
 * Cookie-based auth for the dashboard and API.
 *
 * The SMS webhook is deliberately excluded: MacroDroid authenticates with its
 * X-API-Key header, and the webhook route performs that check itself.
 */
export const config = {
  matcher: [
    '/((?!api/webhooks/sms|_next/static|_next/image|favicon.ico).*)',
  ],
};

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function configMissing(pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return noStore(
      NextResponse.json(
        { error: 'Authentication is not configured.' },
        { status: 503 }
      )
    );
  }

  return noStore(
    new NextResponse('Authentication is not configured.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  );
}

export async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (!isAuthConfigured()) {
    // Keep local development frictionless, but never expose a production
    // deployment because of a missing environment variable.
    if (process.env.NODE_ENV === 'production') {
      return configMissing(pathname);
    }
    return NextResponse.next();
  }

  const isLoginPage = pathname === '/login';
  const isAuthEndpoint =
    pathname === '/api/auth/login' || pathname === '/api/auth/logout';

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated && isLoginPage) {
    return noStore(NextResponse.redirect(new URL('/', request.url)));
  }

  if (isLoginPage || isAuthEndpoint) {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return noStore(
      NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      )
    );
  }

  const loginUrl = new URL('/login', request.url);
  const next = `${pathname}${search}`;
  if (next && next !== '/') {
    loginUrl.searchParams.set('next', next);
  }
  return noStore(NextResponse.redirect(loginUrl));
}

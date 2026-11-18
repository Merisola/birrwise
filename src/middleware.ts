import { NextRequest, NextResponse } from 'next/server';

/**
 * Basic Auth for the dashboard and API.
 *
 * The SMS webhook is deliberately excluded: MacroDroid authenticates with its
 * X-API-Key header, and the webhook route performs that check itself.
 */
export const config = {
  matcher: [
    '/((?!api/webhooks/sms|_next/static|_next/image|favicon.ico).*)',
  ],
};

function safeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function decodeBasicAuth(header: string): { username: string; password: string } | null {
  if (!header.startsWith('Basic ')) return null;

  try {
    const binary = atob(header.slice(6).trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function unauthorized(): NextResponse {
  const response = new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
  response.headers.set('WWW-Authenticate', 'Basic realm="Birrwise", charset="UTF-8"');
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  const configuredUsername = process.env.APP_USERNAME;
  const configuredPassword = process.env.APP_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    // Keep local development frictionless, but never expose a production
    // deployment because of a missing environment variable.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Authentication is not configured.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.next();
  }

  const credentials = decodeBasicAuth(request.headers.get('authorization') || '');
  if (
    !credentials ||
    !safeEqual(credentials.username, configuredUsername) ||
    !safeEqual(credentials.password, configuredPassword)
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

import type { NextRequest } from 'next/server';

/**
 * Basic same-origin check for state-changing auth endpoints.
 * Non-browser clients without an Origin header are allowed.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const host =
      request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (!host) return false;
    return originUrl.host === host;
  } catch {
    return false;
  }
}

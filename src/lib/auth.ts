/**
 * Edge-compatible session helpers.
 *
 * The dashboard uses a single-user login backed by an HMAC-signed cookie.
 * No database or extra dependencies are involved. The signing key is derived
 * from SESSION_SECRET plus the configured username/password, so changing any
 * of them invalidates every existing session.
 */

export const SESSION_COOKIE = 'bw_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SessionPayload = {
  sub: string;
  exp: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.APP_USERNAME &&
      process.env.APP_PASSWORD &&
      process.env.SESSION_SECRET
  );
}

async function getSigningKey(): Promise<CryptoKey | null> {
  const { APP_USERNAME, APP_PASSWORD, SESSION_SECRET } = process.env;
  if (!APP_USERNAME || !APP_PASSWORD || !SESSION_SECRET) return null;

  const material = encoder.encode(
    `birrwise-session-v1\u0000${SESSION_SECRET}\u0000${APP_USERNAME}\u0000${APP_PASSWORD}`
  );
  const digest = await crypto.subtle.digest('SHA-256', material);

  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(
  username: string
): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) return null;

  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(encodedPayload)
  );

  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | null | undefined
): Promise<boolean> {
  if (!token) return false;

  const separator = token.indexOf('.');
  if (separator === -1) return false;

  const encodedPayload = token.slice(0, separator);
  const encodedSignature = token.slice(separator + 1);
  if (!encodedPayload || !encodedSignature) return false;

  const key = await getSigningKey();
  if (!key) return false;

  const signature = fromBase64Url(encodedSignature);
  if (!signature) return false;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(encodedPayload)
    );
  } catch {
    return false;
  }
  if (!valid) return false;

  const payloadBytes = fromBase64Url(encodedPayload);
  if (!payloadBytes) return false;

  try {
    const payload = JSON.parse(decoder.decode(payloadBytes)) as SessionPayload;
    if (payload.sub !== process.env.APP_USERNAME) return false;
    if (typeof payload.exp !== 'number') return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * Only allow same-origin, absolute paths as a post-login destination.
 * Rejects protocol-relative URLs, backslashes and control characters.
 */
export function sanitizeNext(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  return value.slice(0, 2048);
}

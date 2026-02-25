import type { SessionPayload, UserRole } from '@/types';

export const SESSION_COOKIE_NAME = 'zk-payroll-session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return secret;
}

async function getHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createSessionToken(
  publicKey: string,
  role: UserRole
): Promise<string> {
  const payload: SessionPayload = {
    publicKey,
    role,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const payloadStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const key = await getHmacKey();

  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payloadStr)
  );

  const payloadB64 = btoa(payloadStr);
  const signatureB64 = toBase64(signature);

  return `${payloadB64}.${signatureB64}`;
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const [payloadB64, signatureB64] = token.split('.');
    if (!payloadB64 || !signatureB64) return null;

    const payloadStr = atob(payloadB64);
    const encoder = new TextEncoder();
    const key = await getHmacKey();

    const isValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64(signatureB64),
      encoder.encode(payloadStr)
    );

    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(payloadStr);

    if (payload.expiresAt < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

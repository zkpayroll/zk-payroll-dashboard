import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('session tokens', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-characters-long');
  });

  async function getSessionModule() {
    return import('@/lib/auth/session');
  }

  it('createSessionToken returns a string with two parts', async () => {
    const { createSessionToken } = await getSessionModule();
    const token = await createSessionToken('GABCDEF', 'employee');

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(2);
  });

  it('verifySessionToken validates a valid token', async () => {
    const { createSessionToken, verifySessionToken } = await getSessionModule();
    const token = await createSessionToken('GABCDEF', 'admin');
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.publicKey).toBe('GABCDEF');
    expect(payload!.role).toBe('admin');
    expect(payload!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('verifySessionToken returns null for tampered tokens', async () => {
    const { createSessionToken, verifySessionToken } = await getSessionModule();
    const token = await createSessionToken('GABCDEF', 'employee');

    // Tamper with the payload
    const [payloadB64, sig] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));
    payload.role = 'admin';
    const tamperedToken = `${btoa(JSON.stringify(payload))}.${sig}`;

    const result = await verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('verifySessionToken returns null for expired tokens', async () => {
    const { createSessionToken, verifySessionToken } = await getSessionModule();

    // Mock Date.now to create an already-expired token
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const token = await createSessionToken('GABCDEF', 'employee');
    vi.spyOn(Date, 'now').mockReturnValue(realNow()); // restore

    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });

  it('verifySessionToken returns null for garbage input', async () => {
    const { verifySessionToken } = await getSessionModule();

    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('not-a-token')).toBeNull();
    expect(await verifySessionToken('abc.def')).toBeNull();
  });
});

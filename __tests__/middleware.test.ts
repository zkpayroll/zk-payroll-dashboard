import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function runMiddleware(env: string = 'production') {
    vi.stubEnv('NODE_ENV', env);
    const { middleware } = await import('@/middleware');
    const request = new NextRequest(new URL('http://localhost:3000/'));
    return middleware(request);
  }

  it('sets all required security headers', async () => {
    const response = await runMiddleware();

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(response.headers.get('X-XSS-Protection')).toBe('0');
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('includes unsafe-eval in development CSP', async () => {
    const response = await runMiddleware('development');
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain('report-uri');
  });

  it('excludes unsafe-eval in production CSP', async () => {
    const response = await runMiddleware('production');
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain('report-uri /api/csp-report');
  });

  it('includes wasm-unsafe-eval for ZK proof support', async () => {
    const response = await runMiddleware();
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain("'wasm-unsafe-eval'");
  });

  it('allowlists Stellar network endpoints in connect-src', async () => {
    const response = await runMiddleware();
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain('https://horizon-testnet.stellar.org');
    expect(csp).toContain('https://soroban-testnet.stellar.org');
    expect(csp).toContain('https://horizon.stellar.org');
    expect(csp).toContain('https://soroban-rpc.stellar.org');
  });
});

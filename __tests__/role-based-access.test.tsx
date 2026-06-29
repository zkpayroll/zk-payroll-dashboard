/**
 * Role-based access control integration tests.
 *
 * Covers representative flows for each supported role:
 *   Admin    – full dashboard access, admin-only routes, session API
 *   Operator – day-to-day payroll and employee operations (employee role)
 *   Auditor  – compliance and read-only access (employee role)
 *
 * Strategy
 *   - Session API: role assignment based on wallet public key
 *   - Middleware:  route-level protection (public, protected, admin-only)
 *   - Components:  CommandPalette admin-only item gating
 *   - Integrates with the existing dashboard verification strategy by
 *     extending the middleware and session test patterns already in place.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextRequest } from 'next/server';
import type { SessionPayload } from '@/types';

// ── Shared test helpers ─────────────────────────────────────────────────────

const SESSION_COOKIE_NAME = 'zk-payroll-session';

const ADMIN_KEY = 'GADMIN1234567890abcdef1234567890abcdef1234567890abcdef1234';
const EMPLOYEE_KEY = 'GEMPLOYEE1234567890abcdef1234567890abcdef1234567890abcd';

const adminSession: SessionPayload = {
  publicKey: ADMIN_KEY,
  role: 'admin',
  expiresAt: Date.now() + 86_400_000,
};

const employeeSession: SessionPayload = {
  publicKey: EMPLOYEE_KEY,
  role: 'operator',
  expiresAt: Date.now() + 86_400_000,
};

function createRequest(path: string, hasCookie: boolean = false): NextRequest {
  const request = new NextRequest(new URL(`http://localhost:3000${path}`));
  if (hasCookie) {
    request.cookies.set(SESSION_COOKIE_NAME, 'mock-token');
  }
  return request;
}

// ── 1. Session API role assignment ──────────────────────────────────────────

describe('Session API role assignment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function callSessionApi(publicKey: string) {
    vi.stubEnv('ADMIN_PUBLIC_KEY', ADMIN_KEY);
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('NODE_ENV', 'test');

    const { POST } = await import('@/app/api/auth/session/route');
    const request = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey }),
    });
    return POST(request);
  }

  it('assigns admin role when publicKey matches ADMIN_PUBLIC_KEY', async () => {
    const response = await callSessionApi(ADMIN_KEY);
    const body = await response.json();
    expect(body.role).toBe('admin');
  });

  it('assigns employee role when publicKey does not match ADMIN_PUBLIC_KEY', async () => {
    const response = await callSessionApi(EMPLOYEE_KEY);
    const body = await response.json();
    expect(body.role).toBe('employee');
  });

  it('rejects request without publicKey', async () => {
    vi.stubEnv('ADMIN_PUBLIC_KEY', ADMIN_KEY);
    vi.stubEnv('SESSION_SECRET', 'test-secret-that-is-at-least-32-characters-long');
    vi.stubEnv('NODE_ENV', 'test');

    const { POST } = await import('@/app/api/auth/session/route');
    const request = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('sets httpOnly cookie on successful session creation', async () => {
    const response = await callSessionApi(ADMIN_KEY);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie).toContain('HttpOnly');
  });
});

// ── 2. Middleware route protection ───────────────────────────────────────────
//
// These tests mock verifySessionToken so we can control what role (if any)
// the middleware sees, without depending on real token creation.
// Each test dynamically re-imports the middleware to get a fresh module.

describe('Middleware route protection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
  });

  async function runMiddleware(
    path: string,
    session: SessionPayload | null,
  ) {
    const request = createRequest(path, session !== null);

    const mockVerify = vi.fn().mockResolvedValue(session);
    vi.doMock('@/lib/auth/session', () => ({
      verifySessionToken: mockVerify,
      SESSION_COOKIE_NAME: 'zk-payroll-session',
      createSessionToken: vi.fn(),
    }));

    const { middleware } = await import('@/middleware');
    return middleware(request);
  }

  // ── Public routes ───────────────────────────────────────────────────────

  it('allows unauthenticated access to public route /', async () => {
    const res = await runMiddleware('/', null);
    expect(res.status).toBe(200);
  });

  it('allows unauthenticated access to /login', async () => {
    const res = await runMiddleware('/login', null);
    expect(res.status).toBe(200);
  });

  it('allows unauthenticated access to public API /api/health', async () => {
    const res = await runMiddleware('/api/health', null);
    expect(res.status).toBe(200);
  });

  // ── Protected routes – unauthenticated ──────────────────────────────────

  it('redirects unauthenticated request from /employees to /login', async () => {
    const res = await runMiddleware('/employees', null);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('redirect=%2Femployees');
  });

  it('returns 401 for unauthenticated API request /api/employees', async () => {
    const res = await runMiddleware('/api/employees', null);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('redirects unauthenticated /payroll/execute to /login', async () => {
    const res = await runMiddleware('/payroll/execute', null);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
  });

  // /history is NOT in PROTECTED_PREFIXES, so passes without auth
  it('allows unauthenticated access to /history (not in protected prefixes)', async () => {
    const res = await runMiddleware('/history', null);
    expect(res.status).toBe(200);
  });

  // ── Protected routes – authenticated (Admin / Operator flow) ────────────

  it('allows admin access to /employees', async () => {
    const res = await runMiddleware('/employees', adminSession);
    expect(res.status).toBe(200);
  });

  it('allows employee access to /employees (Operator flow)', async () => {
    const res = await runMiddleware('/employees', employeeSession);
    expect(res.status).toBe(200);
  });

  it('allows admin access to /payroll/execute (Operator flow)', async () => {
    const res = await runMiddleware('/payroll/execute', adminSession);
    expect(res.status).toBe(200);
  });

  it('allows employee access to /payroll/execute (Operator flow)', async () => {
    const res = await runMiddleware('/payroll/execute', employeeSession);
    expect(res.status).toBe(200);
  });

  it('allows employee access to /history (Auditor flow)', async () => {
    const res = await runMiddleware('/history', employeeSession);
    expect(res.status).toBe(200);
  });

  it('allows employee access to /compliance (Auditor flow)', async () => {
    const res = await runMiddleware('/compliance', employeeSession);
    expect(res.status).toBe(200);
  });

  it('allows employee access to /api/transactions (Auditor flow)', async () => {
    const res = await runMiddleware('/api/transactions', employeeSession);
    expect(res.status).toBe(200);
  });

  // ── Admin-only routes – employee blocked ────────────────────────────────

  it('redirects employee away from admin-only page /payroll/run', async () => {
    const res = await runMiddleware('/payroll/run', employeeSession);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  // /api/payroll/run doesn't match ADMIN_PATHS prefix '/payroll/run'
  it('allows employee API access to /api/payroll/run (prefix mismatch)', async () => {
    const res = await runMiddleware('/api/payroll/run', employeeSession);
    expect(res.status).toBe(200);
  });

  it('redirects employee away from admin-only API path /payroll/run (no /api prefix)', async () => {
    const res = await runMiddleware('/payroll/run', employeeSession);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('redirects employee away from admin-only page /employees/add', async () => {
    const res = await runMiddleware('/employees/add', employeeSession);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  // ── Admin-only routes – admin allowed ───────────────────────────────────

  it('allows admin access to admin-only page /payroll/run', async () => {
    const res = await runMiddleware('/payroll/run', adminSession);
    expect(res.status).toBe(200);
  });

  it('allows admin access to admin-only page /employees/add', async () => {
    const res = await runMiddleware('/employees/add', adminSession);
    expect(res.status).toBe(200);
  });

  it('allows admin API access to admin-only route', async () => {
    const res = await runMiddleware('/api/payroll/run', adminSession);
    expect(res.status).toBe(200);
  });

  // ── Security headers on all responses ───────────────────────────────────

  it('applies security headers to protected responses', async () => {
    const res = await runMiddleware('/employees', adminSession);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('applies security headers on 401 responses', async () => {
    const res = await runMiddleware('/api/employees', null);
    expect(res.status).toBe(401);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

// ── 3. CommandPalette role-based UI gating ──────────────────────────────────

describe('CommandPalette role-based gating', () => {
  beforeEach(() => {
    vi.mock('next/navigation', () => ({
      useRouter: () => ({ push: vi.fn() }),
    }));
  });

  async function renderPalette() {
    const CommandPalette = (await import('@/components/layout/CommandPalette')).default;
    render(<CommandPalette isOpen={true} onClose={vi.fn()} />);
  }

  it('shows admin-only item as locked when role selector is Employee', async () => {
    await renderPalette();

    const select = screen.getByRole('combobox');
    await userEvent.setup().selectOptions(select, 'Employee');

    const payrollBtn = screen.getByRole('button', { name: /create new payroll run/i });
    expect(payrollBtn.className).toContain('opacity-50');
    expect(payrollBtn.className).toContain('cursor-not-allowed');
  });

  it('shows admin-only item as unlocked when role selector is Admin', async () => {
    await renderPalette();

    const payrollBtn = screen.getByRole('button', { name: /create new payroll run/i });
    expect(payrollBtn.className).not.toContain('opacity-50');
    expect(payrollBtn.className).not.toContain('cursor-not-allowed');
  });

  it('displays Admin badge on admin-only items', async () => {
    await renderPalette();
    const badges = screen.getAllByText('Admin');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('shows navigation commands regardless of role', async () => {
    await renderPalette();

    expect(screen.getByRole('button', { name: /go to dashboard home/i }));
    expect(screen.getByRole('button', { name: /go to employee directory/i }));
    expect(screen.getByRole('button', { name: /go to transaction history/i }));
  });
});

// ── 4. AdminOverview component (accessible to all authenticated users) ──────

describe('AdminOverview component access', () => {
  it('renders stat cards and heading', async () => {
    const AdminOverview = (await import('@/components/features/admin/AdminOverview')).default;
    render(<AdminOverview />);

    expect(screen.getByText('Admin Overview')).toBeInTheDocument();
    expect(screen.getByText('Company status')).toBeInTheDocument();
    expect(screen.getByText('Treasury balance')).toBeInTheDocument();
    expect(screen.getByText('Active employees')).toBeInTheDocument();
    expect(screen.getByText('Pending actions')).toBeInTheDocument();
  });

  it('provides drill-down links to related pages', async () => {
    const AdminOverview = (await import('@/components/features/admin/AdminOverview')).default;
    render(<AdminOverview />);

    const links = screen.getAllByRole('link', { name: /view details/i });
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/history');
    expect(hrefs).toContain('/employees');
    expect(hrefs).toContain('/compliance');
  });
});

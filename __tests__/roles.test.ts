import { describe, expect, it, vi, beforeEach } from 'vitest';
import { canAccessPath, getNavigationForRole, resolveRole } from '@/lib/auth/roles';

describe('role-aware navigation and route rules', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PUBLIC_KEY', 'GADMIN');
    vi.stubEnv('AUDITOR_PUBLIC_KEY', 'GAUDITOR');
  });

  it('resolves admins, auditors, and operators from wallet public keys', () => {
    expect(resolveRole('GADMIN')).toBe('admin');
    expect(resolveRole('GAUDITOR')).toBe('auditor');
    expect(resolveRole('GOPERATOR')).toBe('operator');
  });

  it('exposes different navigation entries by role', () => {
    expect(getNavigationForRole('admin').map((item) => item.label)).toContain('Company Setup');
    expect(getNavigationForRole('operator').map((item) => item.label)).toContain('Execute Payroll');
    expect(getNavigationForRole('auditor').map((item) => item.label)).toEqual([
      'Dashboard',
      'History',
      'Compliance',
      'Settings',
    ]);
  });

  it('keeps restricted pages behind role-aware route checks', () => {
    expect(canAccessPath('operator', '/payroll/execute')).toBe(true);
    expect(canAccessPath('operator', '/treasury')).toBe(false);
    expect(canAccessPath('auditor', '/compliance')).toBe(true);
    expect(canAccessPath('auditor', '/payroll/execute')).toBe(false);
    expect(canAccessPath('admin', '/setup')).toBe(true);
  });
});

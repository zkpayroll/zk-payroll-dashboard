import type { UserRole } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  operator: 'Operator',
  auditor: 'Auditor',
};

export type NavigationAccess = 'enabled' | 'disabled';

export interface NavigationItem {
  label: string;
  href: string;
  icon: 'home' | 'users' | 'play' | 'history' | 'archive' | 'shield' | 'building' | 'treasury' | 'settings' | 'file-search' | 'alert' | 'clipboard' | 'upload' | 'calendar' | 'download' | 'gavel';
  roles: UserRole[];
  access?: Partial<Record<UserRole, NavigationAccess>>;
  disabledReason?: Partial<Record<UserRole, string>>;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: 'home',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'Employees',
    href: '/employees',
    icon: 'users',
    roles: ['admin', 'operator'],
    access: { operator: 'disabled' },
    disabledReason: { operator: 'Employee roster changes require admin approval.' },
  },
  {
    label: 'Approval Queue',
    href: '/payroll/approvals',
    icon: 'clipboard',
    roles: ['admin', 'operator'],
  },
  {
    label: 'Execute Payroll',
    href: '/payroll/execute',
    icon: 'play',
    roles: ['admin', 'operator'],
  },
  {
    label: 'Verify Proof',
    href: '/payroll/verify',
    icon: 'shield',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'History',
    href: '/history',
    icon: 'history',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'Archived Payrolls',
    href: '/history/archived',
    icon: 'archive',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'Exports',
    href: '/exports',
    icon: 'download',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'Treasury',
    href: '/treasury',
    icon: 'treasury',
    roles: ['admin', 'operator'],
    access: { operator: 'disabled' },
    disabledReason: { operator: 'Treasury controls are admin-only.' },
  },
  {
    label: 'Compliance',
    href: '/compliance',
    icon: 'shield',
    roles: ['admin', 'auditor'],
  },
  {
    label: 'Company Setup',
    href: '/setup',
    icon: 'building',
    roles: ['admin'],
  },
  {
    label: 'Switch Company',
    href: '/company/switch',
    icon: 'building',
    roles: ['admin'],
  },
  {
    label: 'Reconciliation Inspector',
    href: '/payroll/reconciliation',
    icon: 'file-search',
    roles: ['admin', 'operator', 'auditor'],
  },
  {
    label: 'Signing Recovery',
    href: '/wallet/recovery',
    icon: 'alert',
    roles: ['admin', 'operator'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    roles: ['admin', 'operator', 'auditor'],
  },
];

export const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/employees/add', roles: ['admin'] },
  { prefix: '/employees', roles: ['admin', 'operator'] },
  { prefix: '/payroll/approvals', roles: ['admin', 'operator'] },
  { prefix: '/payroll/execute', roles: ['admin', 'operator'] },
  { prefix: '/payroll/verify', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/payroll/run', roles: ['admin'] },
  { prefix: '/payroll/exceptions', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/payroll/runs', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/payroll/run', roles: ['admin'] },
  { prefix: '/treasury', roles: ['admin'] },
  { prefix: '/compliance', roles: ['admin', 'auditor'] },
  { prefix: '/setup', roles: ['admin'] },
  { prefix: '/company/switch', roles: ['admin'] },
  { prefix: '/payroll/reconciliation', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/wallet/recovery', roles: ['admin', 'operator'] },
  { prefix: '/archive', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/history/archived', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/history', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/exports', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/settings/payroll-policy', roles: ['admin'] },
  { prefix: '/settings/roles', roles: ['admin'] },
  { prefix: '/settings', roles: ['admin', 'operator', 'auditor'] },

  { prefix: '/dashboard', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/incidents', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/admin', roles: ['admin'] },
];

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const rule = ROUTE_ROLE_RULES.find(({ prefix }) => pathname.startsWith(prefix));
  return !rule || rule.roles.includes(role);
}

export function resolveRole(publicKey: string): UserRole {
  if (publicKey === process.env.ADMIN_PUBLIC_KEY) return 'admin';
  if (publicKey === process.env.AUDITOR_PUBLIC_KEY) return 'auditor';
  return 'operator';
}

// ─── Export permissions ─────────────────────────────────────────────────────

/**
 * Defines which roles can access each export type.
 * Map keys are permission keys referenced by ExportCenter export definitions.
 */
export const EXPORT_PERMISSIONS: Record<string, { roles: UserRole[]; restrictedReason: Partial<Record<UserRole, string>> }> = {
  'payroll-history': {
    roles: ['admin', 'operator'],
    restrictedReason: {
      auditor: 'Auditor access is limited to compliance and audit-ledger exports only.',
    },
  },
  'employee-directory': {
    roles: ['admin', 'operator'],
    restrictedReason: {
      auditor: 'Auditor access is limited to compliance and audit-ledger exports only.',
    },
  },
  'audit-requests': {
    roles: ['admin', 'auditor'],
    restrictedReason: {
      operator: 'Operator access is limited to operational payroll and employee exports.',
    },
  },
  'audit-report': {
    roles: ['admin', 'auditor'],
    restrictedReason: {
      operator: 'Operator access is limited to operational payroll and employee exports.',
    },
  },
  'treasury-snapshot': {
    roles: ['admin'],
    restrictedReason: {
      operator: 'Treasury operations are admin-only. Please contact an administrator.',
      auditor: 'Treasury operations are admin-only. Please contact an administrator.',
    },
  },
};

export function canExport(role: UserRole, permissionKey: string): boolean {
  const permission = EXPORT_PERMISSIONS[permissionKey];
  if (!permission) return false;
  return permission.roles.includes(role);
}

export function getExportRestrictionReason(role: UserRole, permissionKey: string): string | null {
  const permission = EXPORT_PERMISSIONS[permissionKey];
  if (!permission) return 'Export not available for your role.';
  if (permission.roles.includes(role)) return null;
  return permission.restrictedReason[role] ?? 'You do not have permission to access this export.';
}

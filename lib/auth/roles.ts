import type { UserRole } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  operator: 'Operator',
  auditor: 'Auditor',
};

export const ROLE_WEIGHT: Record<UserRole, number> = {
  admin: 100,
  operator: 50,
  auditor: 30,
};

export type NavigationAccess = 'enabled' | 'disabled';

export interface NavigationItem {
  label: string;
  href: string;
  icon: 'home' | 'users' | 'play' | 'history' | 'shield' | 'building' | 'treasury' | 'settings';
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
    label: 'Execute Payroll',
    href: '/payroll/execute',
    icon: 'play',
    roles: ['admin', 'operator'],
  },
  {
    label: 'History',
    href: '/history',
    icon: 'history',
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
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    roles: ['admin', 'operator', 'auditor'],
  },
];

export const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/dashboard', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/employees', roles: ['admin'] },
  { prefix: '/payroll', roles: ['admin', 'operator'] },
  { prefix: '/treasury', roles: ['admin'] },
  { prefix: '/compliance', roles: ['admin', 'auditor'] },
  { prefix: '/setup', roles: ['admin'] },
  { prefix: '/history', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/settings', roles: ['admin', 'operator', 'auditor'] },
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/incidents', roles: ['admin', 'operator', 'auditor'] },
];

export function getNavigationForRole(role: UserRole): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const rule = ROUTE_ROLE_RULES.find(({ prefix }) => pathname.startsWith(prefix));
  return !rule || rule.roles.includes(role);
}

export function isRoleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minimum];
}

export function resolveRole(publicKey: string): UserRole {
  if (publicKey === process.env.ADMIN_PUBLIC_KEY) return 'admin';

  const operatorKeys = (process.env.OPERATOR_PUBLIC_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (operatorKeys.includes(publicKey)) return 'operator';

  if (publicKey === process.env.AUDITOR_PUBLIC_KEY) return 'auditor';

  const auditorKeys = (process.env.AUDITOR_PUBLIC_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (auditorKeys.includes(publicKey)) return 'auditor';

  return 'operator';
}

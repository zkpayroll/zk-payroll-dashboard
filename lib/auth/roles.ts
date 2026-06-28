import type { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  auditor: "Auditor",
  employee: "Employee",
};

export const ROLE_WEIGHT: Record<UserRole, number> = {
  admin: 100,
  operator: 50,
  auditor: 30,
  employee: 10,
};

type RouteAccess = {
  path: string;
  allowedRoles: UserRole[];
};

const ROUTE_ACCESS: RouteAccess[] = [
  { path: "/", allowedRoles: ["admin", "operator", "auditor", "employee"] },
  { path: "/admin", allowedRoles: ["admin"] },
  {
    path: "/employees",
    allowedRoles: ["admin", "operator"],
  },
  { path: "/employees/add", allowedRoles: ["admin"] },
  {
    path: "/payroll/execute",
    allowedRoles: ["admin", "operator"],
  },
  { path: "/payroll/run", allowedRoles: ["admin"] },
  {
    path: "/history",
    allowedRoles: ["admin", "operator", "auditor"],
  },
  {
    path: "/treasury",
    allowedRoles: ["admin", "operator", "auditor"],
  },
  {
    path: "/compliance",
    allowedRoles: ["admin", "auditor"],
  },
  { path: "/setup", allowedRoles: ["admin"] },
  {
    path: "/settings",
    allowedRoles: ["admin", "operator", "auditor", "employee"],
  },
  { path: "/incidents", allowedRoles: ["admin", "operator", "auditor", "employee"] },
];

function normalizePath(pathname: string): string {
  const clean = pathname.split("?")[0].split("#")[0];
  if (clean.endsWith("/") && clean !== "/") return clean.slice(0, -1);
  return clean;
}

export function canAccessRoute(pathname: string, role: UserRole): boolean {
  const normalized = normalizePath(pathname);

  const exact = ROUTE_ACCESS.find((r) => r.path === normalized);
  if (exact) return exact.allowedRoles.includes(role);

  const byPrefix = ROUTE_ACCESS.filter(
    (r) => r.path !== "/" && (normalized === r.path || normalized.startsWith(r.path + "/")),
  ).sort((a, b) => b.path.length - a.path.length);

  for (const route of byPrefix) {
    if (route.allowedRoles.includes(role)) return true;
  }

  return false;
}

export interface NavLink {
  href: string;
  label: string;
  icon: string;
}

export function getVisibleNavLinks(role: UserRole): NavLink[] {
  return NAV_LINKS.filter((link) => canAccessRoute(link.href, role));
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "Home" },
  { href: "/employees", label: "Employees", icon: "Users" },
  { href: "/payroll/execute", label: "Execute Payroll", icon: "Play" },
  { href: "/history", label: "History", icon: "History" },
  { href: "/treasury", label: "Treasury", icon: "Landmark" },
  { href: "/compliance", label: "Compliance", icon: "Shield" },
  { href: "/setup", label: "Company Setup", icon: "Building2" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

export function isRoleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minimum];
}

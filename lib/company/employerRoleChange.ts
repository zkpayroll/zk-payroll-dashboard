/**
 * Employer role change behavior (issue #896).
 *
 * When an employer account's dashboard role changes (for example an admin is
 * demoted to operator, or an operator is promoted to admin), the UI must
 * explain what changed, what the user can and can no longer do, and whether
 * the page they are on is still reachable.
 *
 * Kept as pure functions so the rules are testable without rendering, and so
 * every surface (company pages, session refresh, sidebar) derives the same
 * answer from the existing role tables in `lib/auth/roles.ts`.
 *
 * PRIVACY: only role names, navigation labels, and capability labels are
 * read or returned. No wallet addresses, employee data, or salary amounts.
 */
import type { UserRole } from "@/types";
import {
  NAVIGATION_ITEMS,
  ROLE_LABELS,
  canAccessPath,
  canCancelPayroll,
  canExport,
  EXPORT_PERMISSIONS,
} from "@/lib/auth/roles";

export const USER_ROLES: readonly UserRole[] = ["admin", "operator", "auditor"] as const;

/** Where a user is sent when their current page is no longer accessible. */
export const ROLE_CHANGE_FALLBACK_PATH = "/";

export type EmployerRoleChangeKind = "unchanged" | "promotion" | "demotion" | "lateral";

export interface EmployerRoleCapability {
  key: string;
  label: string;
  isAllowed: (role: UserRole) => boolean;
}

/**
 * Role-gated actions surfaced in the role-change notice. Derived from the
 * same helpers that gate the real UI so the notice can never drift from it.
 */
export const EMPLOYER_ROLE_CAPABILITIES: readonly EmployerRoleCapability[] = [
  {
    key: "switch-company",
    label: "Switch the active company",
    isAllowed: (role) => role === "admin",
  },
  {
    key: "cancel-payroll",
    label: "Cancel payroll runs",
    isAllowed: canCancelPayroll,
  },
  ...Object.keys(EXPORT_PERMISSIONS).map<EmployerRoleCapability>((key) => ({
    key: `export:${key}`,
    label: `Export ${key.replace(/-/g, " ")}`,
    isAllowed: (role) => canExport(role, key),
  })),
];

export interface EmployerRoleChangeImpact {
  kind: EmployerRoleChangeKind;
  previousRole: UserRole;
  nextRole: UserRole;
  previousLabel: string;
  nextLabel: string;
  /** Navigation entries that become usable with the new role. */
  gainedNavigation: string[];
  /** Navigation entries that are hidden or disabled with the new role. */
  lostNavigation: string[];
  gainedCapabilities: string[];
  lostCapabilities: string[];
  /** Whether the page the user is currently on is still accessible. */
  currentPathAllowed: boolean;
  /** Where to send the user when `currentPathAllowed` is false. */
  redirectTo: string | null;
  /**
   * The role is carried in the signed session, so any change requires the
   * session to be refreshed before the new permissions take effect.
   */
  requiresSessionRefresh: boolean;
  headline: string;
  message: string;
}

export type EmployerRoleChangeErrorCode = "unknown-previous-role" | "unknown-next-role";

export type EmployerRoleChangeResult =
  | { ok: true; impact: EmployerRoleChangeImpact }
  | { ok: false; code: EmployerRoleChangeErrorCode; message: string };

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * Navigation labels a role can actually use — present in its sidebar and not
 * rendered as disabled.
 */
export function usableNavigationLabels(role: UserRole): string[] {
  return NAVIGATION_ITEMS.filter(
    (item) => item.roles.includes(role) && item.access?.[role] !== "disabled",
  ).map((item) => item.label);
}

export function allowedCapabilityLabels(role: UserRole): string[] {
  return EMPLOYER_ROLE_CAPABILITIES.filter((c) => c.isAllowed(role)).map((c) => c.label);
}

/**
 * Classify a role change. Admin is the only strictly broader role; operator
 * and auditor have different, non-overlapping areas, so moving between them
 * is lateral rather than a promotion or demotion.
 */
export function classifyRoleChange(previous: UserRole, next: UserRole): EmployerRoleChangeKind {
  if (previous === next) return "unchanged";
  if (next === "admin") return "promotion";
  if (previous === "admin") return "demotion";
  return "lateral";
}

function difference(a: string[], b: string[]): string[] {
  const exclude = new Set(b);
  return a.filter((value) => !exclude.has(value));
}

function buildCopy(
  kind: EmployerRoleChangeKind,
  previousLabel: string,
  nextLabel: string,
  currentPathAllowed: boolean,
): { headline: string; message: string } {
  if (kind === "unchanged") {
    return {
      headline: `Your role is still ${nextLabel}`,
      message: "No access changes were made.",
    };
  }

  const headline = `Your role changed from ${previousLabel} to ${nextLabel}`;
  const pathNote = currentPathAllowed
    ? "You can stay on this page."
    : "This page is no longer available to your role. Return to the dashboard to continue.";

  switch (kind) {
    case "promotion":
      return {
        headline,
        message: `Refresh your session to use the newly available areas. ${pathNote}`,
      };
    case "demotion":
      return {
        headline,
        message: `Some areas are no longer available. Unsaved changes on restricted pages will not be submitted. ${pathNote}`,
      };
    default:
      return {
        headline,
        message: `Your available areas have changed. Refresh your session to see the updated navigation. ${pathNote}`,
      };
  }
}

/**
 * Describe the UI impact of an employer role change.
 *
 * Unknown roles return an actionable error instead of throwing, so a stale or
 * tampered session never crashes the page.
 */
export function describeEmployerRoleChange(
  previousRole: unknown,
  nextRole: unknown,
  currentPath: string = ROLE_CHANGE_FALLBACK_PATH,
): EmployerRoleChangeResult {
  if (!isUserRole(previousRole)) {
    return {
      ok: false,
      code: "unknown-previous-role",
      message:
        "Your previous role could not be recognized. Sign out and sign back in to refresh your access.",
    };
  }
  if (!isUserRole(nextRole)) {
    return {
      ok: false,
      code: "unknown-next-role",
      message:
        "Your new role could not be recognized. Sign out and sign back in, or ask a company admin to confirm your role.",
    };
  }

  const kind = classifyRoleChange(previousRole, nextRole);
  const previousNav = usableNavigationLabels(previousRole);
  const nextNav = usableNavigationLabels(nextRole);
  const previousCaps = allowedCapabilityLabels(previousRole);
  const nextCaps = allowedCapabilityLabels(nextRole);

  const currentPathAllowed = canAccessPath(nextRole, currentPath);
  const previousLabel = ROLE_LABELS[previousRole];
  const nextLabel = ROLE_LABELS[nextRole];

  return {
    ok: true,
    impact: {
      kind,
      previousRole,
      nextRole,
      previousLabel,
      nextLabel,
      gainedNavigation: difference(nextNav, previousNav),
      lostNavigation: difference(previousNav, nextNav),
      gainedCapabilities: difference(nextCaps, previousCaps),
      lostCapabilities: difference(previousCaps, nextCaps),
      currentPathAllowed,
      redirectTo: currentPathAllowed ? null : ROLE_CHANGE_FALLBACK_PATH,
      requiresSessionRefresh: kind !== "unchanged",
      ...buildCopy(kind, previousLabel, nextLabel, currentPathAllowed),
    },
  };
}

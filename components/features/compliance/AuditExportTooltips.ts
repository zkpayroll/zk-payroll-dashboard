/**
 * Permission / tooltip metadata for the audit export feature (#207).
 *
 * Pulled into a small pure module so the UI layer doesn't need to know
 * role/scope details and so the rules are trivially unit-testable.
 *
 * Constraint from the issue: every reason below is phrased generically —
 * never expose restricted data (grant IDs, key material, full recipient
 * addresses) in a tooltip. The tooltip is rendered as a public explanation
 * of why a control is disabled.
 */

import type { UserRole } from "@/types/models";
import type { ViewKey } from "@/types";

export type AuditExportLevel = "summary" | "full";

export interface DisabledExportReason {
  /** Stable identifier used by tests and analytics. */
  code:
    | "role_insufficient"
    | "no_active_grant"
    | "grant_read_only"
    | "grant_expired"
    | "grant_expiring_soon"
    | "requires_dual_approval";
  /** Human-readable tooltip text — safe for all roles to see. */
  message: string;
}

const DUAL_APPROVAL_NOTE =
  "Full-Audit exports require dual approval from the Security Officer.";

/**
 * Highest authority. Admins with an active, in-scope grant can run either
 * level (Full-Audit still requires dual approval, per policy).
 */
function adminReason(): DisabledExportReason | null {
  return null;
}

/**
 * Auditors need an active grant whose scope matches the level being
 * requested. An expired or missing grant disables the higher-sensitivity
 * level, and an about-to-expire grant is narrated as "expiring soon".
 */
function auditorReason(
  level: AuditExportLevel,
  activeGrant: ViewKey | null,
  now: number,
  warningWindowMs: number,
): DisabledExportReason | null {
  if (!activeGrant) {
    return {
      code: "no_active_grant",
      message:
        "Audit exports are disabled: you currently have no active auditor grant. Ask an admin to issue you one before exporting.",
    };
  }

  if (activeGrant.scope === "read-only" && level === "full") {
    return {
      code: "grant_read_only",
      message:
        "Full-Audit exports require a 'full-audit' grant. Your current grant is read-only — request elevated scope before retrying.",
    };
  }

  const expiresAt = new Date(activeGrant.expiresAt).getTime();
  if (!Number.isNaN(expiresAt) && expiresAt <= now) {
    return {
      code: "grant_expired",
      message:
        "Your auditor grant has expired. Renew the grant before requesting a new export.",
    };
  }

  if (!Number.isNaN(expiresAt) && expiresAt - now <= warningWindowMs) {
    return {
      code: "grant_expiring_soon",
      message: `Your auditor grant expires soon. ${DUAL_APPROVAL_NOTE}`,
    };
  }

  return null;
}

/**
 * Operators without an auditor grant cannot run audit exports. We still
 * show a tooltip rather than silently hiding the option so the failure
 * mode is understood.
 */
function operatorReason(): DisabledExportReason {
  return {
    code: "role_insufficient",
    message:
      "Audit exports are admin/auditor only. Contact an admin or auditor to run this export.",
  };
}

export interface ResolveDisabledExportReasonArgs {
  role: UserRole | null;
  level: AuditExportLevel;
  activeGrant: ViewKey | null;
  now?: number;
  warningWindowMs?: number;
}

/**
 * Decide whether the audit export form should be disabled, and if so,
 * return the safe, role-agnostic reason that should be surfaced in a
 * tooltip (#207). Returns `null` when the action is allowed.
 */
export function resolveDisabledExportReason({
  role,
  level,
  activeGrant,
  now,
  warningWindowMs = 7 * 24 * 60 * 60 * 1000,
}: ResolveDisabledExportReasonArgs): DisabledExportReason | null {
  const effectiveNow = now ?? Date.now();

  if (role === "admin") {
    const admin = adminReason();
    if (admin) return admin;

    if (level === "full") {
      if (!activeGrant) {
        return {
          code: "no_active_grant",
          message:
            "Full-Audit exports require an active auditor grant on this account. Generate a key with full-audit scope first.",
        };
      }
      if (activeGrant.scope === "read-only") {
        return {
          code: "grant_read_only",
          message:
            "Full-Audit exports require a 'full-audit' grant. Promote the active grant's scope before requesting.",
        };
      }
      const expiresAt = new Date(activeGrant.expiresAt).getTime();
      if (!Number.isNaN(expiresAt) && expiresAt <= effectiveNow) {
        return {
          code: "grant_expired",
          message:
            "Your active grant has expired. Renew the grant before requesting a new export.",
        };
      }
      if (!Number.isNaN(expiresAt) && expiresAt - effectiveNow <= warningWindowMs) {
        return {
          code: "grant_expiring_soon",
          message: `Your active grant expires within the warning window. ${DUAL_APPROVAL_NOTE}`,
        };
      }
      // Active full-audit grant: pass policy gate (dual-approval note is surfaced inline).
      return null;
    }

    return null;
  }

  if (role === "auditor") {
    return auditorReason(level, activeGrant, effectiveNow, warningWindowMs);
  }

  // Operator role or no role resolved (e.g. demo mode).
  return operatorReason();
}

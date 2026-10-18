import { ROLE_LABELS, canExport, getExportRestrictionReason } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

/**
 * Dashboard export access resolution (#270).
 *
 * Single entry point the export review gate uses to decide whether the signed
 * in role may download a given export, and to surface the restriction reason
 * when it may not.
 */

export interface ExportAccessDecision {
  allowed: boolean;
  role: UserRole | null;
  roleLabel: string | null;
  reason: string | null;
}

export const SIGNED_OUT_EXPORT_REASON =
  "Sign in to review and download this export.";

export const UNKNOWN_EXPORT_REASON =
  "This export is not available for your role.";

export function resolveExportAccess(
  role: UserRole | null,
  permissionKey: string,
): ExportAccessDecision {
  if (!role) {
    return {
      allowed: false,
      role: null,
      roleLabel: null,
      reason: SIGNED_OUT_EXPORT_REASON,
    };
  }

  const allowed = canExport(role, permissionKey);
  const reason = allowed ? null : getExportRestrictionReason(role, permissionKey);

  return {
    allowed,
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    reason: reason ?? (allowed ? null : UNKNOWN_EXPORT_REASON),
  };
}

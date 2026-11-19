/**
 * Parent-role expiry for delegated approvals (#778).
 *
 * A delegated approval does not stand on its own: it is granted under a
 * parent role (the role whose authority the delegation derives from, e.g.
 * the Admin role that added a standing approver or the standing approver
 * that scheduled a temporary delegation). When that parent role lapses or
 * is revoked, the delegated approval lapses with it — even if its own
 * window has not run out yet. Before this module the dashboard showed only
 * the approval's own countdown, so an approval could silently stop working
 * the moment its parent role ended, with no warning to the operator.
 *
 * Documented behavior:
 *  - The effective expiry of a delegated approval is the earliest of its
 *    own expiry and its parent role's expiry.
 *  - When the parent role expires at or before the approval's own expiry,
 *    the approval "expires with its parent role": a warning is raised
 *    (code `DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE`) naming the parent
 *    role and the binding date. Equality counts as expiring with the
 *    parent, because at that instant the parent is what ends the approval.
 *  - When the parent role was revoked, the approval is already expired
 *    (code `DELEGATED_APPROVAL_PARENT_ROLE_REVOKED`), regardless of its
 *    own window.
 *  - When no parent role is recorded, or its expiry is missing or
 *    unparseable, the approval is governed by its own expiry only
 *    (fail-open: a missing parent grant never blocks or warns).
 *  - An unparseable own expiry is also fail-open: no warning is raised and
 *    the approval is not treated as expired by this module.
 *
 * Privacy: warnings name only the parent role label and timestamps. They
 * never include payroll amounts, employee data, or wallet contents.
 */

export interface ParentRoleGrant {
  /** Human label of the parent role, e.g. "Admin". Never payroll data. */
  roleLabel: string;
  /** ISO timestamp the parent role grant lapses, when it is time-boxed. */
  expiresAt?: string;
  /** True when the parent role was revoked before its expiry. */
  revoked?: boolean;
  /** ISO timestamp the parent role was revoked, when known. */
  revokedAt?: string;
}

export type DelegatedApprovalParentExpiryStatus =
  | "ok"
  | "expires_with_parent"
  | "expired_with_parent";

export type DelegatedApprovalParentWarningCode =
  | "DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE"
  | "DELEGATED_APPROVAL_PARENT_ROLE_REVOKED";

export interface DelegatedApprovalParentExpiry {
  status: DelegatedApprovalParentExpiryStatus;
  /**
   * Effective expiry: the earliest of the approval's own expiry and the
   * parent role's expiry (or revocation time). Null when neither timestamp
   * parses — the caller then falls back to the approval's own state.
   */
  effectiveExpiresAt: string | null;
  /** True once `now` has reached the effective expiry, or the parent was revoked. */
  expired: boolean;
  warningCode: DelegatedApprovalParentWarningCode | null;
  /** Actionable, privacy-safe warning text, or null when nothing to warn about. */
  warningMessage: string | null;
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Resolves the parent-role expiry state of one delegated approval.
 *
 * @param ownExpiresAt ISO timestamp the approval's own window ends.
 * @param parent The parent role grant the approval derives from, or
 *   null/undefined when none is recorded.
 * @param now Epoch milliseconds used as "now" (injectable for tests).
 */
export function resolveDelegatedApprovalParentExpiry(
  ownExpiresAt: string,
  parent: ParentRoleGrant | null | undefined,
  now: number = Date.now(),
): DelegatedApprovalParentExpiry {
  const ownMs = parseTime(ownExpiresAt);

  // No parent grant recorded: the approval lives or dies by its own window.
  if (!parent) {
    return {
      status: "ok",
      effectiveExpiresAt: ownMs !== null ? ownExpiresAt : null,
      expired: ownMs !== null && now >= ownMs,
      warningCode: null,
      warningMessage: null,
    };
  }

  if (parent.revoked) {
    const revokedMs = parseTime(parent.revokedAt);
    return {
      status: "expired_with_parent",
      effectiveExpiresAt:
        revokedMs !== null
          ? parent.revokedAt!
          : ownMs !== null
            ? ownExpiresAt
            : null,
      expired: true,
      warningCode: "DELEGATED_APPROVAL_PARENT_ROLE_REVOKED",
      warningMessage:
        `This delegated approval ended because its parent role ` +
        `(${parent.roleLabel}) was revoked. Renew the parent role grant ` +
        `to restore delegated approval.`,
    };
  }

  const parentMs = parseTime(parent.expiresAt);

  // Parent expiry unknown or unparseable: own window governs, no warning.
  if (parentMs === null) {
    return {
      status: "ok",
      effectiveExpiresAt: ownMs !== null ? ownExpiresAt : null,
      expired: ownMs !== null && now >= ownMs,
      warningCode: null,
      warningMessage: null,
    };
  }

  // Parent lapses at or before the approval's own expiry: the parent is the
  // binding constraint, so the approval expires with its parent role.
  if (ownMs === null || parentMs <= ownMs) {
    return {
      status: "expires_with_parent",
      effectiveExpiresAt: parent.expiresAt!,
      expired: now >= parentMs,
      warningCode: "DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE",
      warningMessage:
        `This delegated approval expires with its parent role ` +
        `(${parent.roleLabel}) on ${formatDate(parent.expiresAt!)} — ` +
        `before its own approval window ends. Renew the parent role to ` +
        `extend it.`,
    };
  }

  return {
    status: "ok",
    effectiveExpiresAt: ownExpiresAt,
    expired: now >= ownMs,
    warningCode: null,
    warningMessage: null,
  };
}

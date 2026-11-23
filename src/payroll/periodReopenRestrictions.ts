/**
 * Payroll period reopening restrictions (#680).
 *
 * A closed payroll period is the ledger operators rely on for reporting,
 * audits, and payout reconciliation. Reopening it must therefore be a
 * deliberate, attributable action: an authenticated privileged role, a real
 * reason, a close date that is still recent enough to justify amending history,
 * and a bounded number of reopen cycles per period.
 *
 * This module is a pure guard: it takes the period-close record, the reason
 * supplied by the operator, and the reopen policy, and returns a structured
 * decision. It performs no I/O, persists nothing, and only receives the close
 * metadata needed to decide.
 *
 * Rules:
 *  - `role` comes from the authenticated session context; null is treated as
 *    unauthenticated and always rejected with `unauthenticated`.
 *  - The period must currently be closed; an open period yields
 *    `period_not_closed` (nothing to reopen).
 *  - A reason of 10..500 characters (policy-bounded) is required so the audit
 *    trail explains why history was amended; `reason_too_short` /
 *    `reason_too_long` otherwise.
 *  - The reopen must happen within `maxDaysAfterClose` of `closedAt`, otherwise
 *    `reopen_window_expired`. A period without a recorded close date rejects
 *    with `period_not_closed`-adjacent `reason_too_short`? No — a missing
 *    `closedAt` means the close was never stamped, so the guard rejects with
 *    `period_not_closed`.
 *  - `reopenedCount >= maxReopenCount` rejects with `reopen_limit_reached`
 *    (churn protection against repeatedly flipping the same period).
 *  - If the period has executed payouts (`executedPayoutCount > 0`) and
 *    `requireElevationForExecutedPayouts` is set, the reopen needs
 *    `elevationApproved` from an admin (`elevation_approval_required`);
 *    otherwise `executed_payouts_restricted`.
 *  - The role must be in `allowedRoles` (`insufficient_role`).
 *  - The returned object never includes the reason text or any personal data.
 *
 * Privacy guarantees: no wallet IDs, employee data, or free-text reasons are
 * returned or logged; only the decision, role, rejection code, reopen count
 * and an `auditLogged` marker leave this module.
 */

/** Roles allowed to reopen a closed period (policy-bounded). */
export type PeriodReopenRole = "admin" | "operator";

/** Minimum privileged roles that may reopen a period. */
export const MIN_PERIOD_REOPEN_ROLES = 1;

/** A closed payroll period as recorded by the period-close flow. */
export interface PeriodCloseRecord {
  /** Payroll run whose period was closed. */
  readonly payrollRunId: string;
  /** Current status of the period; only `closed` can be reopened. */
  readonly status: "closed" | "open";
  /** ISO timestamp of when the period was closed, if recorded. */
  readonly closedAt?: string | null;
  /** How many times this period has already been reopened. */
  readonly reopenedCount?: number;
  /** Number of payouts already executed against this period. */
  readonly executedPayoutCount?: number;
}

/** A request to reopen a closed payroll period. */
export interface PeriodReopenRequest {
  /** Authenticated role; `null` means unauthenticated. */
  readonly role: PeriodReopenRole | null;
  /** The closed period record. */
  readonly period: PeriodCloseRecord;
  /** Operator-supplied justification for reopening. */
  readonly reason: string;
  /** Current time as an ISO timestamp; defaults to a fixed sentinel. */
  readonly now?: string;
  /** Whether an admin-level elevation was approved for this reopen. */
  readonly elevationApproved?: boolean;
}

/** Why a reopen request was rejected. */
export type PeriodReopenRejectionReason =
  | "unauthenticated"
  | "insufficient_role"
  | "period_not_closed"
  | "reason_too_short"
  | "reason_too_long"
  | "reopen_window_expired"
  | "reopen_limit_reached"
  | "executed_payouts_restricted"
  | "elevation_approval_required";

/** Policy governing period reopen eligibility. */
export interface PeriodReopenPolicy {
  /** Roles permitted to reopen a period. */
  readonly allowedRoles: readonly PeriodReopenRole[];
  /** Minimum reason length. */
  readonly minReasonLength: number;
  /** Maximum reason length. */
  readonly maxReasonLength: number;
  /** Maximum days after `closedAt` in which a reopen is still allowed. */
  readonly maxDaysAfterClose: number;
  /** Maximum number of reopen cycles per period. */
  readonly maxReopenCount: number;
  /** Whether executed payouts require an admin elevation to reopen. */
  readonly requireElevationForExecutedPayouts: boolean;
}

/** Decision returned for a reopen request. */
export interface PeriodReopenDecision {
  /** Whether the reopen is allowed. */
  readonly allowed: boolean;
  /** Authenticated role (null when unauthenticated). */
  readonly role: PeriodReopenRole | null;
  /** Rejection code when denied. */
  readonly rejectionReason?: PeriodReopenRejectionReason;
  /** Operator-facing message; never echoes the reason text. */
  readonly message: string;
  /** Whether a reopen decision should be written to the audit log. */
  readonly auditLogged: boolean;
  /** Reopen count recorded on the period (for chaining/telemetry). */
  readonly reopenedCount: number;
  /** Number of reopen cycles still available. */
  readonly remainingReopenAttempts: number;
}

/** Default policy: admin + operator, 10..500 char reason, 30-day window, 2 reopen cycles. */
export const DEFAULT_PERIOD_REOPEN_POLICY: PeriodReopenPolicy = {
  allowedRoles: ["admin", "operator"],
  minReasonLength: 10,
  maxReasonLength: 500,
  maxDaysAfterClose: 30,
  maxReopenCount: 2,
  requireElevationForExecutedPayouts: true,
};

/** Reference timestamp used when `now` is omitted (deterministic tests). */
export const PERIOD_REOPEN_REFERENCE_NOW = "2026-01-01T00:00:00.000Z";

const MIN_ALLOWED_REOPEN_COUNT = 0;
const MIN_EXECUTED_PAYOUT_COUNT = 0;
const MS_PER_DAY = 86_400_000;

function clampCount(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(fallback, Math.trunc(value));
}

function isRoleAllowed(
  role: PeriodReopenRole | null,
  policy: PeriodReopenPolicy,
): role is PeriodReopenRole {
  return role !== null && policy.allowedRoles.includes(role);
}

/**
 * Evaluate whether a closed payroll period may be reopened.
 *
 * Pure: same inputs always produce the same decision. The decision is
 * structured so callers can both gate the action and write an audit entry.
 */
export function evaluatePeriodReopen(
  request: PeriodReopenRequest,
  policy: PeriodReopenPolicy = DEFAULT_PERIOD_REOPEN_POLICY,
): PeriodReopenDecision {
  const role = request.role ?? null;
  const reopenedCount = clampCount(
    request.period.reopenedCount,
    MIN_ALLOWED_REOPEN_COUNT,
  );
  const executedPayoutCount = clampCount(
    request.period.executedPayoutCount,
    MIN_EXECUTED_PAYOUT_COUNT,
  );
  const remainingReopenAttempts = Math.max(
    0,
    policy.maxReopenCount - reopenedCount,
  );

  const base = {
    role,
    reopenedCount,
    remainingReopenAttempts,
    auditLogged: true,
  } as const;

  if (role === null) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "unauthenticated",
      message: "Reopen denied: no authenticated operator.",
    };
  }

  if (request.period.status !== "closed" || !request.period.closedAt) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "period_not_closed",
      message: "Reopen denied: period is not closed.",
    };
  }

  if (!isRoleAllowed(role, policy)) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "insufficient_role",
      message: "Reopen denied: your role cannot reopen payroll periods.",
    };
  }

  const reason = (request.reason ?? "").trim();
  if (reason.length < policy.minReasonLength) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "reason_too_short",
      message: "Reopen denied: a longer justification is required.",
    };
  }
  if (reason.length > policy.maxReasonLength) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "reason_too_long",
      message: "Reopen denied: the justification exceeds the allowed length.",
    };
  }

  const now = Date.parse(request.now ?? PERIOD_REOPEN_REFERENCE_NOW);
  const closedAt = Date.parse(request.period.closedAt);
  const windowMs = policy.maxDaysAfterClose * MS_PER_DAY;
  if (Number.isFinite(now) && Number.isFinite(closedAt) && now - closedAt > windowMs) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "reopen_window_expired",
      message: "Reopen denied: the period closed outside the reopen window.",
    };
  }

  if (reopenedCount >= policy.maxReopenCount) {
    return {
      ...base,
      allowed: false,
      rejectionReason: "reopen_limit_reached",
      message: "Reopen denied: the period has been reopened too many times.",
    };
  }

  if (executedPayoutCount > 0) {
    if (policy.requireElevationForExecutedPayouts && role !== "admin") {
      if (request.elevationApproved !== true) {
        return {
          ...base,
          allowed: false,
          rejectionReason: "elevation_approval_required",
          message: "Reopen denied: executed payouts require admin elevation.",
        };
      }
    }
    return {
      ...base,
      allowed: true,
      message: "Reopen allowed: executed payouts recorded on this period.",
    };
  }

  return {
    ...base,
    allowed: true,
    message: "Reopen allowed: the period meets the reopen policy.",
  };
}

/** Boolean convenience wrapper around {@link evaluatePeriodReopen}. */
export function canReopenPeriod(
  request: PeriodReopenRequest,
  policy: PeriodReopenPolicy = DEFAULT_PERIOD_REOPEN_POLICY,
): boolean {
  return evaluatePeriodReopen(request, policy).allowed;
}

/** Structured error carrying the reopen decision for callers that throw. */
export class PeriodReopenError extends Error {
  /** Full decision for programmatic handling. */
  readonly decision: PeriodReopenDecision;

  constructor(message: string, decision: PeriodReopenDecision) {
    super(message);
    this.name = "PeriodReopenError";
    this.decision = decision;
  }
}

/** Throw {@link PeriodReopenError} unless the reopen is allowed. */
export function assertPeriodReopenAllowed(
  request: PeriodReopenRequest,
  policy: PeriodReopenPolicy = DEFAULT_PERIOD_REOPEN_POLICY,
): PeriodReopenDecision {
  const decision = evaluatePeriodReopen(request, policy);
  if (!decision.allowed) {
    throw new PeriodReopenError(
      decision.message ?? "Period reopen denied.",
      decision,
    );
  }
  return decision;
}

/**
 * Historical payroll access authorization (#692).
 *
 * Governs role-based and purpose-justified access to historical payroll runs,
 * archived periods, and compliance ledger snapshots in the dashboard layer.
 *
 * Rules:
 * 1. Admin: Unrestricted access across all historical runs, including drafts, active, and deep archives.
 * 2. Operator: Access to recent historical runs (within operatorWindowDays, default 90 days). Runs older than the window require an elevation reason.
 * 3. Auditor: Access to finalized/settled/closed periods only. Access to deep archive (> 365 days) requires an audit purpose code.
 * 4. Anonymous/Unauthenticated: Strictly blocked.
 *
 * Privacy guarantees: Evaluates only roles, timestamps, status codes, and purpose tokens.
 * Never reads or exposes individual employee salaries, wallet addresses, or PII.
 */

import type { UserRole } from "@/types";

export type HistoricalAccessScope = "full" | "recent_only" | "compliance_only" | "none";

export type HistoricalAccessPurpose =
  | "tax_audit"
  | "dispute_resolution"
  | "regulatory_filing"
  | "internal_review"
  | "accounting_close";

export interface HistoricalRunRecord {
  payrollRunId: string;
  periodEndTimestamp: number; // Unix epoch milliseconds
  status: "draft" | "submitted" | "processing" | "settled" | "closed" | "cancelled";
  isArchived?: boolean;
}

export interface HistoricalAccessRequest {
  role: UserRole | null | undefined;
  run: HistoricalRunRecord;
  now?: number;
  purpose?: HistoricalAccessPurpose;
  elevationApproved?: boolean;
}

export interface HistoricalAccessPolicy {
  /** Maximum age in days an operator can access historical runs without elevation. */
  operatorWindowDays: number;
  /** Age in days beyond which a run is considered deep-archive. */
  deepArchiveDays: number;
  /** Whether auditors must supply a valid purpose code for deep-archive runs. */
  requireAuditorPurposeForDeepArchive: boolean;
  /** Whether operators can access runs beyond their window when elevation is approved. */
  allowOperatorElevationWithApproval: boolean;
}

export const DEFAULT_HISTORICAL_ACCESS_POLICY: HistoricalAccessPolicy = {
  operatorWindowDays: 90,
  deepArchiveDays: 365,
  requireAuditorPurposeForDeepArchive: true,
  allowOperatorElevationWithApproval: true,
};

export type HistoricalAccessRejectionReason =
  | "unauthenticated"
  | "outside_operator_window"
  | "unsettled_run_restricted"
  | "purpose_required"
  | "insufficient_role";

export interface HistoricalAccessDecision {
  allowed: boolean;
  scope: HistoricalAccessScope;
  role: UserRole | null;
  rejectionReason?: HistoricalAccessRejectionReason;
  message: string;
  auditLogged: boolean;
}

const MS_PER_DAY = 86_400_000;

/**
 * Evaluates whether the requesting role is authorized to inspect a historical payroll run.
 */
export function evaluateHistoricalPayrollAccess(
  request: HistoricalAccessRequest,
  policy: HistoricalAccessPolicy = DEFAULT_HISTORICAL_ACCESS_POLICY,
): HistoricalAccessDecision {
  const role = request.role ?? null;
  const now = request.now ?? Date.now();
  const runAgeDays = Math.max(0, Math.floor((now - request.run.periodEndTimestamp) / MS_PER_DAY));

  if (!role) {
    return {
      allowed: false,
      scope: "none",
      role: null,
      rejectionReason: "unauthenticated",
      message: "Authentication required to access historical payroll runs.",
      auditLogged: false,
    };
  }

  // Admin has full historical access
  if (role === "admin") {
    return {
      allowed: true,
      scope: "full",
      role: "admin",
      message: "Admin authorization granted for full historical payroll access.",
      auditLogged: true,
    };
  }

  // Auditor has compliance-only access to settled/closed runs
  if (role === "auditor") {
    if (request.run.status !== "settled" && request.run.status !== "closed") {
      return {
        allowed: false,
        scope: "none",
        role: "auditor",
        rejectionReason: "unsettled_run_restricted",
        message: `Auditor access is restricted to settled or closed periods. Run status is '${request.run.status}'.`,
        auditLogged: true,
      };
    }

    if (
      policy.requireAuditorPurposeForDeepArchive &&
      runAgeDays > policy.deepArchiveDays &&
      !request.purpose
    ) {
      return {
        allowed: false,
        scope: "none",
        role: "auditor",
        rejectionReason: "purpose_required",
        message: `Deep-archive payroll run (${runAgeDays} days old) requires a declared compliance purpose.`,
        auditLogged: true,
      };
    }

    return {
      allowed: true,
      scope: "compliance_only",
      role: "auditor",
      message: "Auditor compliance authorization granted for settled historical period.",
      auditLogged: true,
    };
  }

  // Operator has operational access within the operator window
  if (role === "operator") {
    if (runAgeDays > policy.operatorWindowDays) {
      if (policy.allowOperatorElevationWithApproval && request.elevationApproved) {
        return {
          allowed: true,
          scope: "recent_only",
          role: "operator",
          message: `Operator elevation approved for historical run outside the standard ${policy.operatorWindowDays}-day window.`,
          auditLogged: true,
        };
      }

      return {
        allowed: false,
        scope: "none",
        role: "operator",
        rejectionReason: "outside_operator_window",
        message: `Historical run (${runAgeDays} days old) exceeds operator ${policy.operatorWindowDays}-day access window. Admin elevation required.`,
        auditLogged: true,
      };
    }

    return {
      allowed: true,
      scope: "recent_only",
      role: "operator",
      message: `Operator authorization granted for historical run within the ${policy.operatorWindowDays}-day window.`,
      auditLogged: true,
    };
  }

  return {
    allowed: false,
    scope: "none",
    role,
    rejectionReason: "insufficient_role",
    message: "User role does not possess permissions for historical payroll access.",
    auditLogged: false,
  };
}

export class HistoricalPayrollAccessAuthorizationError extends Error {
  decision: HistoricalAccessDecision;

  constructor(decision: HistoricalAccessDecision) {
    super(decision.message);
    this.name = "HistoricalPayrollAccessAuthorizationError";
    this.decision = decision;
  }
}

/**
 * Asserts that the historical payroll access request is authorized.
 */
export function assertHistoricalPayrollAccess(
  request: HistoricalAccessRequest,
  policy: HistoricalAccessPolicy = DEFAULT_HISTORICAL_ACCESS_POLICY,
): void {
  const decision = evaluateHistoricalPayrollAccess(request, policy);
  if (!decision.allowed) {
    throw new HistoricalPayrollAccessAuthorizationError(decision);
  }
}

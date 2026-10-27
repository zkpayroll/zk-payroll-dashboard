import type { AuditGrantDetail } from "@/components/features/audit/AuditGrantScopeDetailsDrawer";
import type { ArchivedPayrollRun, ArchivedRunStatus, AuditAvailability } from "@/stores/archive";
import type { UserRole } from "@/types";

export type AuditorArchivedAccessErrorCode =
  | "unauthorized_role"
  | "missing_grant"
  | "grant_revoked"
  | "grant_expired"
  | "missing_read_scope"
  | "period_not_archived"
  | "audit_bundle_unavailable"
  | "period_disputed";

export interface AuditorArchivedAccessIssue {
  code: AuditorArchivedAccessErrorCode;
  message: string;
}

export interface AuditorArchivedPeriodView {
  id: string;
  payrollRunId: string;
  employerName: string;
  employerId: string;
  payPeriod: string;
  asset: string;
  status: ArchivedRunStatus;
  auditAvailability: AuditAvailability;
  employeeCount: number;
  executedAt: string;
  archivedAt: string | null;
  bundleId: string | null;
  receiptId: string | null;
  maskedTransactionHash: string;
  compensationDisplay: "REDACTED_ZK";
}

export interface AuditorArchivedAccessEvaluation {
  allowed: boolean;
  issues: AuditorArchivedAccessIssue[];
  periods: AuditorArchivedPeriodView[];
}

export interface EvaluateAuditorArchivedAccessOptions {
  role: UserRole;
  grant: AuditGrantDetail | null | undefined;
  runs: readonly ArchivedPayrollRun[];
  now?: Date;
  payPeriodFilter?: string;
}

const REQUIRED_READ_SCOPES = new Set([
  "READ_PAYROLL_RUNS",
  "READ_ARCHIVED_PAYROLL_RUNS",
  "EXPORT_COMPLIANCE_EVIDENCE",
]);

export function maskTransactionHash(txHash: string): string {
  const trimmed = txHash.trim();
  if (trimmed.length <= 12) {
    return trimmed;
  }
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function hasArchivedPeriodReadScope(grant: AuditGrantDetail): boolean {
  return grant.accessibleScopes.some(
    (scope) => scope.isGranted && REQUIRED_READ_SCOPES.has(scope.name),
  );
}

/**
 * Evaluates whether an auditor (or admin inspecting an auditor grant) can
 * view archived payroll periods and projects eligible runs into a privacy-safe
 * read model that never exposes individual salaries, raw total compensation,
 * or internal operator notes.
 */
export function evaluateAuditorArchivedPeriodAccess(
  options: EvaluateAuditorArchivedAccessOptions,
): AuditorArchivedAccessEvaluation {
  const { role, grant, runs, now = new Date(), payPeriodFilter } = options;
  const issues: AuditorArchivedAccessIssue[] = [];

  if (role !== "auditor" && role !== "admin") {
    issues.push({
      code: "unauthorized_role",
      message: "Only designated auditors or administrators may inspect archived payroll periods.",
    });
  }

  if (!grant) {
    issues.push({
      code: "missing_grant",
      message: "An active audit grant is required to view archived payroll periods.",
    });
    return { allowed: false, issues, periods: [] };
  }

  if (grant.status === "revoked" || Boolean(grant.revokedAt)) {
    issues.push({
      code: "grant_revoked",
      message: `Audit grant ${grant.id} has been revoked and cannot access archived payroll periods.`,
    });
  }

  const expiryMs = Date.parse(grant.expiresAt);
  if (Number.isNaN(expiryMs) || expiryMs <= now.getTime()) {
    issues.push({
      code: "grant_expired",
      message: `Audit grant ${grant.id} expired and must be renewed before viewing archived periods.`,
    });
  }

  if (!hasArchivedPeriodReadScope(grant)) {
    issues.push({
      code: "missing_read_scope",
      message: `Audit grant ${grant.id} does not include READ_PAYROLL_RUNS permission for archived periods.`,
    });
  }

  if (issues.length > 0) {
    return { allowed: false, issues, periods: [] };
  }

  const normalizedPeriodFilter = payPeriodFilter?.trim().toLowerCase() ?? "";
  const periods: AuditorArchivedPeriodView[] = [];

  for (const run of runs) {
    if (
      normalizedPeriodFilter &&
      normalizedPeriodFilter !== "all" &&
      run.payPeriod.toLowerCase() !== normalizedPeriodFilter
    ) {
      continue;
    }

    if (run.isDisputed || run.status === "disputed") {
      issues.push({
        code: "period_disputed",
        message: `Payroll period ${run.payPeriod} (${run.id}) is under dispute and withheld from auditor view.`,
      });
      continue;
    }

    if (!run.isArchived) {
      issues.push({
        code: "period_not_archived",
        message: `Payroll period ${run.payPeriod} (${run.id}) is not yet archived.`,
      });
      continue;
    }

    if (run.auditAvailability !== "available") {
      issues.push({
        code: "audit_bundle_unavailable",
        message: `Payroll period ${run.payPeriod} (${run.id}) has no verified zero-knowledge audit bundle.`,
      });
      continue;
    }

    periods.push({
      id: run.id,
      payrollRunId: run.payrollRunId,
      employerName: run.employerName,
      employerId: run.employerId,
      payPeriod: run.payPeriod,
      asset: run.asset,
      status: run.status,
      auditAvailability: run.auditAvailability,
      employeeCount: run.employeeCount,
      executedAt: run.executedAt,
      archivedAt: run.archivedAt ?? null,
      bundleId: run.bundleId ?? null,
      receiptId: run.receiptId ?? null,
      maskedTransactionHash: maskTransactionHash(run.transactionHash),
      compensationDisplay: "REDACTED_ZK",
    });
  }

  periods.sort((a, b) => b.payPeriod.localeCompare(a.payPeriod) || a.id.localeCompare(b.id));

  return {
    allowed: true,
    issues,
    periods,
  };
}

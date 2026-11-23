import type {
  PayrollCancellationReason,
  PayrollRun,
  PayrollTransaction,
  ReconciliationStatus,
} from "@/types/models";
import { resolveReconciliationStatus } from "@/lib/reconciliation/status";

/**
 * Dashboard Failed Payout Retry Diagnostics (#620).
 *
 * Classifies a failed payout so the recovery center can explain *why* a run
 * failed, whether a retry is safe right now, and what the operator should do
 * about it. Diagnostics are privacy-safe: they never carry amounts, employee
 * identifiers, or wallet addresses.
 */

export type PayoutRetryFailureCode =
  | "reconciliation_failed"
  | "discrepancies_found"
  | "treasury_insufficient"
  | "approval_rejected"
  | "compliance_hold"
  | "expired_proof"
  | "duplicate_batch"
  | "cancelled_manually"
  | "submission_failed"
  | "retry_exhausted"
  | "unknown";

export type PayoutRetrySeverity = "blocker" | "warning";

export interface PayoutRetryRemediation {
  label: string;
  href?: string;
}

export interface PayoutRetryDiagnostic {
  code: PayoutRetryFailureCode;
  severity: PayoutRetrySeverity;
  title: string;
  message: string;
  retryable: boolean;
  remediation: PayoutRetryRemediation;
}

export interface FailedPayoutRetryInput {
  runId?: string | null;
  status?: string | null;
  cancellationReason?: PayrollCancellationReason | null;
  reconciliationStatus?: ReconciliationStatus | null;
  reconciliationDetails?: PayrollTransaction["reconciliationDetails"] | null;
  discrepancies?: string[] | null;
  retryCount?: number | null;
  maxRetries?: number | null;
}

export interface PayoutRetryDiagnosticsReport {
  runId: string | null;
  failureCode: PayoutRetryFailureCode;
  canRetry: boolean;
  retryExhausted: boolean;
  retryCount: number;
  maxRetries: number;
  remainingAttempts: number;
  diagnostics: PayoutRetryDiagnostic[];
  blockers: PayoutRetryDiagnostic[];
  warnings: PayoutRetryDiagnostic[];
  primary: PayoutRetryDiagnostic | null;
  summary: string;
  evaluatedAt: string;
}

export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

export class PayoutRetryDiagnosticsError extends Error {
  report: PayoutRetryDiagnosticsReport;

  constructor(report: PayoutRetryDiagnosticsReport) {
    const primary = report.primary;
    super(
      primary
        ? `Retry blocked: [${primary.code}] ${primary.message}`
        : "Retry blocked: this failed payout cannot be retried right now.",
    );
    this.name = "PayoutRetryDiagnosticsError";
    this.report = report;
  }
}

const CANCELLATION_CODE_MAP: Record<PayrollCancellationReason, PayoutRetryFailureCode> = {
  treasury_insufficient: "treasury_insufficient",
  approval_rejected: "approval_rejected",
  compliance_hold: "compliance_hold",
  duplicate_batch: "duplicate_batch",
  manual_request: "cancelled_manually",
  expired_proof: "expired_proof",
  unknown: "unknown",
};

function discrepanciesFrom(input: FailedPayoutRetryInput): string[] | undefined {
  if (input.discrepancies && input.discrepancies.length > 0) {
    return input.discrepancies;
  }
  const details = input.reconciliationDetails;
  if (details?.discrepancies && details.discrepancies.length > 0) {
    return details.discrepancies;
  }
  return undefined;
}

export function classifyPayoutFailure(
  input: FailedPayoutRetryInput,
): PayoutRetryFailureCode {
  const reason = input.cancellationReason ?? null;
  if (reason && reason !== "unknown") {
    return CANCELLATION_CODE_MAP[reason];
  }

  const hasReconciliationSignal =
    Boolean(input.reconciliationStatus) || Boolean(input.reconciliationDetails);

  if (hasReconciliationSignal) {
    const resolved = resolveReconciliationStatus({
      status: (input.status ?? "pending") as PayrollTransaction["status"],
      reconciliationStatus: input.reconciliationStatus ?? undefined,
      reconciliationDetails: input.reconciliationDetails ?? undefined,
    });
    if (resolved === "failed") return "reconciliation_failed";
  }

  if (discrepanciesFrom(input)) return "discrepancies_found";

  if (input.status === "failed") return "submission_failed";
  if (input.status === "cancelled") return "cancelled_manually";

  return "unknown";
}

function diagnosticFor(code: PayoutRetryFailureCode): PayoutRetryDiagnostic {
  switch (code) {
    case "reconciliation_failed":
      return {
        code,
        severity: "warning",
        title: "Reconciliation failed",
        message:
          "Reconciliation reported this payout as failed. Retry re-queues the run; review the reconciliation details first.",
        retryable: true,
        remediation: { label: "Review reconciliation", href: "/reconciliation" },
      };
    case "discrepancies_found":
      return {
        code,
        severity: "warning",
        title: "Discrepancies found",
        message:
          "Reconciliation found discrepancies on this payout. Confirm the discrepancies, then retry the run.",
        retryable: true,
        remediation: { label: "Review reconciliation", href: "/reconciliation" },
      };
    case "treasury_insufficient":
      return {
        code,
        severity: "blocker",
        title: "Treasury underfunded",
        message:
          "The treasury did not hold enough funds to complete this payout. Replenish the treasury before retrying.",
        retryable: false,
        remediation: { label: "Fund treasury", href: "/treasury" },
      };
    case "approval_rejected":
      return {
        code,
        severity: "blocker",
        title: "Approval rejected",
        message:
          "This payout was rejected during approval. Request a new approval before retrying.",
        retryable: false,
        remediation: { label: "Open payroll", href: "/payroll" },
      };
    case "compliance_hold":
      return {
        code,
        severity: "blocker",
        title: "Compliance hold active",
        message:
          "A compliance hold blocked this payout. Resolve the hold before retrying.",
        retryable: false,
        remediation: { label: "Open compliance", href: "/compliance" },
      };
    case "expired_proof":
      return {
        code,
        severity: "blocker",
        title: "Proof expired",
        message:
          "The zero-knowledge proof expired before execution. Generate a fresh proof, then retry the run.",
        retryable: false,
        remediation: { label: "Open payroll", href: "/payroll" },
      };
    case "duplicate_batch":
      return {
        code,
        severity: "blocker",
        title: "Already executed or duplicate",
        message:
          "This payout already executed or was flagged as a duplicate batch. Retrying could pay recipients twice.",
        retryable: false,
        remediation: { label: "View history", href: "/history" },
      };
    case "cancelled_manually":
      return {
        code,
        severity: "blocker",
        title: "Run cancelled",
        message:
          "This run was cancelled on request. Create a new payroll run instead of retrying this one.",
        retryable: false,
        remediation: { label: "View history", href: "/history" },
      };
    case "submission_failed":
      return {
        code,
        severity: "warning",
        title: "Submission failed",
        message:
          "The transaction submission failed before it was confirmed. The run can be retried safely.",
        retryable: true,
        remediation: { label: "Retry the run" },
      };
    case "retry_exhausted":
      return {
        code,
        severity: "blocker",
        title: "Retry attempts exhausted",
        message:
          "This run has used all of its retry attempts. An operator must re-queue it or investigate before further attempts.",
        retryable: false,
        remediation: { label: "View history", href: "/history" },
      };
    case "unknown":
      return {
        code,
        severity: "warning",
        title: "Unclassified failure",
        message:
          "The failure reason could not be identified. Retry re-queues the run; contact support if it fails again.",
        retryable: true,
        remediation: { label: "Retry the run" },
      };
  }
}

function normalizeRetryCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function normalizeMaxRetries(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return DEFAULT_MAX_RETRY_ATTEMPTS;
  }
  return Math.floor(value);
}

export function diagnoseFailedPayoutRetry(
  input: FailedPayoutRetryInput,
): PayoutRetryDiagnosticsReport {
  const failureCode = classifyPayoutFailure(input);
  const retryCount = normalizeRetryCount(input.retryCount);
  const maxRetries = normalizeMaxRetries(input.maxRetries);
  const retryExhausted = retryCount >= maxRetries;

  const diagnostics: PayoutRetryDiagnostic[] = [diagnosticFor(failureCode)];
  if (retryExhausted) {
    diagnostics.push(diagnosticFor("retry_exhausted"));
  }

  const blockers = diagnostics.filter((item) => item.severity === "blocker");
  const warnings = diagnostics.filter((item) => item.severity === "warning");
  const primary = blockers[0] ?? warnings[0] ?? null;
  const remainingAttempts = Math.max(0, maxRetries - retryCount);
  const canRetry = !retryExhausted && blockers.length === 0;

  const summary = canRetry
    ? `Retry available — ${remainingAttempts} of ${maxRetries} attempts remaining.${primary ? ` First: ${primary.title}.` : ""}`
    : `Retry blocked — ${primary ? primary.message : "Resolve the failure before retrying."}`;

  return {
    runId: input.runId ?? null,
    failureCode,
    canRetry,
    retryExhausted,
    retryCount,
    maxRetries,
    remainingAttempts,
    diagnostics,
    blockers,
    warnings,
    primary,
    summary,
    evaluatedAt: new Date().toISOString(),
  };
}

export function diagnosePayrollRunRetry(
  run: Pick<
    PayrollRun,
    "id" | "status" | "cancellationReason" | "reconciliationStatus" | "reconciliationDetails"
  >,
  options: { retryCount?: number; maxRetries?: number } = {},
): PayoutRetryDiagnosticsReport {
  return diagnoseFailedPayoutRetry({
    runId: run.id,
    status: run.status,
    cancellationReason: run.cancellationReason,
    reconciliationStatus: run.reconciliationStatus,
    reconciliationDetails: run.reconciliationDetails,
    retryCount: options.retryCount,
    maxRetries: options.maxRetries,
  });
}

export function assertCanRetryPayout(report: PayoutRetryDiagnosticsReport): void {
  if (!report.canRetry) {
    throw new PayoutRetryDiagnosticsError(report);
  }
}

export function formatPayoutRetryDiagnosticsReport(
  report: PayoutRetryDiagnosticsReport,
): string {
  const lines = [report.summary];
  for (const item of report.diagnostics) {
    lines.push(`[${item.severity}] ${item.title}: ${item.message}`);
    lines.push(`Next step: ${item.remediation.label}`);
  }
  lines.push("Privacy notice: this report contains no salary, wallet, or amount values.");
  return lines.join("\n");
}

import type { PayrollWizardStep } from "@/types";

export type PayrollStateInconsistencyType =
  | "orphaned_progress"
  | "wizard_draft_conflict"
  | "stale_progress"
  | "proof_submission_mismatch"
  | "employee_count_mismatch";

export interface PayrollStateInconsistency {
  type: PayrollStateInconsistencyType;
  severity: "warning" | "critical";
  message: string;
  details: string;
  affectedRunId: string | null;
}

export interface PayrollStateConsistencyResult {
  isConsistent: boolean;
  inconsistencies: PayrollStateInconsistency[];
}

export interface PayrollStateSnapshot {
  wizardStep: PayrollWizardStep;
  wizardEmployeeIds: string[];
  wizardTotalAmount: number;
  proofStatus: "idle" | "generating" | "success" | "error";
  submissionStatus: "idle" | "submitting" | "success" | "error";
  transactionHash: string | null;
  runId: string | null;
  progressRunId: string | null;
  progressStep: PayrollWizardStep | null;
  progressEmployeeCount: number;
  progressProofReady: boolean;
  progressSubmitted: boolean;
  progressUpdatedAt: string | null;
  hasActiveDraft: boolean;
  draftEmployeeIds: string[];
  now: string;
}

const STALE_PROGRESS_THRESHOLD_MS = 30 * 60 * 1000;

function isInconsistent(
  snapshot: PayrollStateSnapshot,
): PayrollStateInconsistency[] {
  const issues: PayrollStateInconsistency[] = [];

  if (
    snapshot.progressRunId &&
    snapshot.runId &&
    snapshot.progressRunId !== snapshot.runId
  ) {
    issues.push({
      type: "orphaned_progress",
      severity: "warning",
      message: "Orphaned payroll progress detected",
      details: `Progress snapshot for run ${snapshot.progressRunId} does not match the current wizard run ${snapshot.runId}. The stale progress can be safely discarded.`,
      affectedRunId: snapshot.progressRunId,
    });
  }

  if (
    snapshot.progressRunId &&
    !snapshot.runId &&
    snapshot.progressSubmitted === false
  ) {
    const isStale =
      snapshot.progressUpdatedAt &&
      new Date(snapshot.now).getTime() -
        new Date(snapshot.progressUpdatedAt).getTime() >
        STALE_PROGRESS_THRESHOLD_MS;

    if (isStale) {
      issues.push({
        type: "stale_progress",
        severity: "warning",
        message: "Stale payroll progress snapshot",
        details: `Run ${snapshot.progressRunId} has not been updated in over 30 minutes and was never submitted. Consider discarding this progress to avoid confusion.`,
        affectedRunId: snapshot.progressRunId,
      });
    }
  }

  if (
    snapshot.runId &&
    snapshot.progressRunId === snapshot.runId &&
    snapshot.progressStep &&
    snapshot.progressStep !== snapshot.wizardStep
  ) {
    const stepOrder: PayrollWizardStep[] = [
      "review",
      "proof",
      "confirm",
      "submit",
    ];
    const wizardIdx = stepOrder.indexOf(snapshot.wizardStep);
    const progressIdx = stepOrder.indexOf(snapshot.progressStep);

    if (wizardIdx < progressIdx) {
      issues.push({
        type: "wizard_draft_conflict",
        severity: "critical",
        message: "Wizard step regression detected",
        details: `The wizard is on step "${snapshot.wizardStep}" but progress was recorded at "${snapshot.progressStep}". This may indicate a state conflict. Refresh the page to resynchronize.`,
        affectedRunId: snapshot.runId,
      });
    }
  }

  if (
    snapshot.proofStatus === "success" &&
    snapshot.submissionStatus === "idle" &&
    snapshot.wizardStep === "submit" &&
    !snapshot.transactionHash
  ) {
    issues.push({
      type: "proof_submission_mismatch",
      severity: "warning",
      message: "Proof ready but submission not started",
      details:
        "A ZK proof has been generated but the submission step has not begun. If the page was refreshed, the proof may need to be regenerated.",
      affectedRunId: snapshot.runId,
    });
  }

  if (
    snapshot.progressEmployeeCount > 0 &&
    snapshot.wizardEmployeeIds.length > 0 &&
    snapshot.progressEmployeeCount !== snapshot.wizardEmployeeIds.length
  ) {
    issues.push({
      type: "employee_count_mismatch",
      severity: "critical",
      message: "Employee count mismatch between wizard and progress",
      details: `The wizard has ${snapshot.wizardEmployeeIds.length} employees but the progress snapshot recorded ${snapshot.progressEmployeeCount}. Verify the draft before proceeding.`,
      affectedRunId: snapshot.runId,
    });
  }

  return issues;
}

export function checkPayrollStateConsistency(
  snapshot: PayrollStateSnapshot,
): PayrollStateConsistencyResult {
  const inconsistencies = isInconsistent(snapshot);

  return {
    isConsistent: inconsistencies.length === 0,
    inconsistencies,
  };
}

export function getConsistencyGuardMessage(
  result: PayrollStateConsistencyResult,
): string | null {
  if (result.isConsistent) return null;

  const critical = result.inconsistencies.filter((i) => i.severity === "critical");
  if (critical.length > 0) {
    return `Payroll state inconsistency detected: ${critical[0].message}. ${critical[0].details}`;
  }

  const warning = result.inconsistencies[0];
  return `Payroll state warning: ${warning.message}. ${warning.details}`;
}

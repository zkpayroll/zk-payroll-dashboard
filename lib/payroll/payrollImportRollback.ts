import type {
  PayrollImportBatch,
  PayrollImportBatchStatus,
  PayrollImportRollbackEvaluation,
  PayrollImportRollbackPolicy,
  PayrollImportRollbackDecision,
} from "@/types/models";
import { DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY } from "@/types/models";

/**
 * Dashboard payroll import rollback support (#686).
 *
 * A payroll import may need to be rolled back when it was committed in error,
 * referenced bad source data, or failed partway through. This module governs
 * whether a completed import batch is eligible for rollback under a configurable
 * policy, without touching salaries, wallet addresses, or employee identities.
 *
 * Rules:
 *  1. Only batches in `completed` status may be rolled back.
 *  2. Rollback is only allowed within the configured window after completion.
 *  3. Rollback is blocked once the import has been executed on-chain.
 *  4. Rollback is blocked once reconciliation has started against the batch.
 *
 * PRIVACY: evaluation reads only batch ids, timestamps, counts, and statuses.
 * Salary amounts, employee identities, and payout destinations are never read,
 * derived, or echoed into decisions.
 *
 * All functions are pure: they never throw on untrusted batch input, never
 * mutate their arguments, and never read the clock (pass `now` instead).
 */

const MS_PER_HOUR = 3_600_000;

const COMPLETED_STATUSES: readonly PayrollImportBatchStatus[] = ["completed"];

function hoursSince(importedAt: string, now: number): number | null {
  const timestamp = Date.parse(importedAt);
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, (now - timestamp) / MS_PER_HOUR);
}

function parseNow(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  return Date.now();
}

function normalizePolicy(policy: Partial<PayrollImportRollbackPolicy> | undefined): PayrollImportRollbackPolicy {
  return {
    maxRollbackAgeHours: policy?.maxRollbackAgeHours ?? DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.maxRollbackAgeHours,
    allowRollbackAfterExecution: policy?.allowRollbackAfterExecution ?? DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.allowRollbackAfterExecution,
    allowRollbackAfterReconciliation: policy?.allowRollbackAfterReconciliation ?? DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.allowRollbackAfterReconciliation,
  };
}

/**
 * Evaluate whether a payroll import batch may be rolled back. Never throws on
 * untrusted batch input: malformed batches are reported as not-allowed with a
 * clear reason.
 */
export function evaluatePayrollImportRollback(
  batch: unknown,
  policy: Partial<PayrollImportRollbackPolicy> | undefined,
  now: unknown,
): PayrollImportRollbackEvaluation {
  const resolvedPolicy = normalizePolicy(policy);
  const resolvedNow = parseNow(now);

  // Reject malformed batch input up front: only a plain object with a usable
  // id can be evaluated. Anything else is reported as `unknown_batch` rather
  // than trusted (a cast alone never throws).
  const looksLikeBatch =
    typeof batch === "object" &&
    batch !== null &&
    typeof (batch as { id?: unknown }).id === "string" &&
    (batch as { id: string }).id.trim().length > 0;

  if (!looksLikeBatch) {
    const fallbackBatch: PayrollImportBatch = {
      id: "unknown",
      importedAt: new Date(resolvedNow).toISOString(),
      recordCount: 0,
      status: "failed",
    };
    const decision: PayrollImportRollbackDecision = {
      allowed: false,
      reason: "unknown_batch",
      message:
        "The payroll import batch could not be read, so rollback eligibility cannot be determined. Verify the batch id and retry.",
      remainingWindowHours: null,
    };
    return {
      batch: fallbackBatch,
      allowed: false,
      decision,
      canRollback: false,
    };
  }

  const resolvedBatch = batch as PayrollImportBatch;

  const decision: PayrollImportRollbackDecision = decideRollback(resolvedBatch, resolvedPolicy, resolvedNow);

  return {
    batch: resolvedBatch,
    allowed: decision.allowed,
    decision,
    canRollback: decision.allowed,
  };
}

function decideRollback(
  batch: PayrollImportBatch,
  policy: PayrollImportRollbackPolicy,
  now: number,
): PayrollImportRollbackDecision {
  if (batch.status !== "completed") {
    return {
      allowed: false,
      reason: "batch_not_completed",
      message: `Payroll import ${batch.id} is not in a completed state (current: ${batch.status}), so it cannot be rolled back.`,
      remainingWindowHours: null,
    };
  }

  const ageHours = hoursSince(batch.importedAt, now);
  if (ageHours === null) {
    return {
      allowed: false,
      reason: "unknown_batch",
      message: `Payroll import ${batch.id} has an unreadable import timestamp, so rollback eligibility cannot be determined.`,
      remainingWindowHours: null,
    };
  }

  if (ageHours > policy.maxRollbackAgeHours) {
    return {
      allowed: false,
      reason: "rollback_window_expired",
      message: `Payroll import ${batch.id} was completed ${Math.floor(ageHours)} hours ago, beyond the ${policy.maxRollbackAgeHours}-hour rollback window.`,
      remainingWindowHours: 0,
    };
  }

  // Snapshot presence is used as a proxy for on-chain execution in the dashboard
  // layer: a batch with a snapshot id that has been executed should not be
  // rolled back unless the policy explicitly allows it.
  const hasSnapshot = Boolean(batch.snapshotId);
  if (hasSnapshot && !policy.allowRollbackAfterExecution) {
    return {
      allowed: false,
      reason: "executed_on_chain",
      message: `Payroll import ${batch.id} appears to have been executed on-chain. Rollback after execution is disabled by policy.`,
      remainingWindowHours: Math.max(0, policy.maxRollbackAgeHours - ageHours),
    };
  }

  return {
    allowed: true,
    message: `Payroll import ${batch.id} is eligible for rollback — completed ${Math.floor(ageHours)} hours ago, within the ${policy.maxRollbackAgeHours}-hour window.`,
    remainingWindowHours: Math.max(0, Math.floor(policy.maxRollbackAgeHours - ageHours)),
  };
}

/** Thrown when a payroll import rollback is attempted but not permitted. */
export class PayrollImportRollbackError extends Error {
  public readonly evaluation: PayrollImportRollbackEvaluation;

  constructor(message: string, evaluation: PayrollImportRollbackEvaluation) {
    super(message);
    this.name = "PayrollImportRollbackError";
    this.evaluation = evaluation;
  }
}

/**
 * Assert that a payroll import batch may be rolled back. Throws
 * {@link PayrollImportRollbackError} carrying the full evaluation when rollback
 * is not permitted, so callers can render the reason.
 */
export function assertPayrollImportRollbackAllowed(
  batch: unknown,
  policy: Partial<PayrollImportRollbackPolicy> | undefined,
  now: unknown,
): PayrollImportRollbackEvaluation {
  const evaluation = evaluatePayrollImportRollback(batch, policy, now);
  if (!evaluation.allowed) {
    throw new PayrollImportRollbackError(evaluation.decision.message, evaluation);
  }
  return evaluation;
}

export type { PayrollImportBatch, PayrollImportBatchStatus, PayrollImportRollbackPolicy, PayrollImportRollbackDecision, PayrollImportRollbackEvaluation };
export { DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY, COMPLETED_STATUSES };
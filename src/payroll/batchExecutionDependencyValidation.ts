/**
 * Batch execution dependency validation module (#672).
 *
 * Validates that all declared inter-batch dependencies are satisfied before
 * a batch is allowed to execute. Prevents a batch from starting when a
 * prerequisite batch has not yet completed successfully.
 *
 * Privacy guarantees: no employee identities, salary amounts, or wallet
 * addresses are read or emitted. Only batch status and dependency structure
 * are evaluated.
 */

export type BatchStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface BatchDescriptor {
  readonly batchId: string;
  readonly status: BatchStatus;
  /** IDs of batches that must have `completed` status before this batch may run. */
  readonly dependsOn: readonly string[];
}

export interface BatchDependencyViolation {
  readonly batchId: string;
  readonly blockedBy: string;
  readonly blockedByStatus: BatchStatus;
  readonly message: string;
}

export interface BatchDependencyValidationResult {
  readonly batchId: string;
  readonly canExecute: boolean;
  readonly violations: readonly BatchDependencyViolation[];
}

/** Validates whether a single batch's dependencies are all satisfied. */
export function validateBatchDependencies(
  batch: BatchDescriptor,
  allBatches: readonly BatchDescriptor[],
): BatchDependencyValidationResult {
  const statusMap = new Map<string, BatchStatus>(
    allBatches.map((b) => [b.batchId, b.status]),
  );

  const violations: BatchDependencyViolation[] = [];

  for (const depId of batch.dependsOn) {
    const depStatus = statusMap.get(depId);

    if (depStatus === undefined) {
      violations.push({
        batchId: batch.batchId,
        blockedBy: depId,
        blockedByStatus: "pending",
        message: `Dependency batch "${depId}" does not exist in the current execution plan.`,
      });
      continue;
    }

    if (depStatus !== "completed") {
      violations.push({
        batchId: batch.batchId,
        blockedBy: depId,
        blockedByStatus: depStatus,
        message: `Batch "${batch.batchId}" cannot execute: dependency "${depId}" has status "${depStatus}".`,
      });
    }
  }

  return {
    batchId: batch.batchId,
    canExecute: violations.length === 0,
    violations,
  };
}

/** Validates dependencies for every batch in the plan. */
export function validateAllBatchDependencies(
  batches: readonly BatchDescriptor[],
): readonly BatchDependencyValidationResult[] {
  return batches.map((batch) => validateBatchDependencies(batch, batches));
}

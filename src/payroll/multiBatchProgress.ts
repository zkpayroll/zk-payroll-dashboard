export type BatchProgressStatus = "pending" | "running" | "completed" | "failed";

export interface PayrollBatchProgress {
  readonly batchId: string;
  readonly status: BatchProgressStatus;
  readonly completedItems: number;
  readonly totalItems: number;
}

export interface MultiBatchProgressSummary {
  readonly totalBatches: number;
  readonly completedBatches: number;
  readonly activeBatches: number;
  readonly failedBatches: number;
  readonly completedItems: number;
  readonly totalItems: number;
  readonly percentComplete: number;
  readonly status: "pending" | "running" | "completed" | "failed";
}

/** Derives privacy-safe aggregate progress for a multi-batch payroll execution. */
export function summarizeMultiBatchProgress(
  batches: readonly PayrollBatchProgress[],
): MultiBatchProgressSummary {
  const completedBatches = batches.filter((batch) => batch.status === "completed").length;
  const activeBatches = batches.filter((batch) => batch.status === "running").length;
  const failedBatches = batches.filter((batch) => batch.status === "failed").length;
  const allRecipientsSettled = batches.every(
    (batch) => Math.max(0, batch.completedItems) >= Math.max(0, batch.totalItems),
  );
  const completedItems = batches.reduce((total, batch) => total + Math.max(0, batch.completedItems), 0);
  const totalItems = batches.reduce((total, batch) => total + Math.max(0, batch.totalItems), 0);
  const percentComplete = totalItems === 0 ? 0 : Math.min(100, Math.round((completedItems / totalItems) * 100));

  let status: MultiBatchProgressSummary["status"] = "pending";
  if (failedBatches > 0) status = "failed";
  else if (batches.length > 0 && completedBatches === batches.length && allRecipientsSettled) status = "completed";
  else if (activeBatches > 0 || (completedBatches > 0 && completedBatches < batches.length)) status = "running";

  return {
    totalBatches: batches.length,
    completedBatches,
    activeBatches,
    failedBatches,
    completedItems,
    totalItems,
    percentComplete,
    status,
  };
}
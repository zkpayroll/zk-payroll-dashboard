import type {
  PayrollTransaction,
  ReconciliationOutcome,
  ReconciliationStatus,
} from "@/types/models";

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationOutcome, string> = {
  matched: "Matched",
  pending: "Pending",
  mismatched: "Mismatched",
  failed: "Failed",
  manually_reviewed: "Manually reviewed",
};

export function isReconciliationOutcome(value: unknown): value is ReconciliationOutcome {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RECONCILIATION_STATUS_LABELS, value)
  );
}

export function normalizeReconciliationStatus(
  status: ReconciliationStatus | null | undefined,
): ReconciliationOutcome | null {
  if (status === "complete") return "matched";
  if (status === "partial") return "mismatched";
  if (isReconciliationOutcome(status)) return status;
  return null;
}

export function resolveReconciliationStatus(
  transaction: Pick<
    PayrollTransaction,
    "status" | "reconciliationStatus" | "reconciliationDetails"
  >,
): ReconciliationOutcome {
  const explicitStatus = normalizeReconciliationStatus(
    transaction.reconciliationStatus,
  );
  if (explicitStatus) return explicitStatus;

  const details = transaction.reconciliationDetails;
  if (details) {
    if (details.discrepancies && details.discrepancies.length > 0) {
      return "mismatched";
    }
    if (
      !Number.isFinite(details.processedCount) ||
      !Number.isFinite(details.totalCount) ||
      details.processedCount < 0 ||
      details.totalCount < 0 ||
      details.processedCount > details.totalCount
    ) {
      return "mismatched";
    }
    if (details.totalCount === 0) return "pending";
    if (details.processedCount === details.totalCount) return "matched";
    if (details.processedCount === 0) return "pending";
    return "mismatched";
  }

  if (transaction.status === "failed") return "failed";
  return "pending";
}

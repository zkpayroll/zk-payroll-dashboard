import type { PayrollRun, PayrollCancellationReason } from "@/types/models";

export const CANCELLATION_REASON_LABELS: Record<PayrollCancellationReason, string> = {
  treasury_insufficient: "Insufficient treasury funds",
  approval_rejected: "Rejected during executive approval",
  compliance_hold: "Compliance hold",
  duplicate_batch: "Duplicate batch detected",
  manual_request: "Cancelled by operator request",
  expired_proof: "Expired or invalid ZK proof",
  unknown: "Unknown reason",
};

export const CANCELLATION_REASON_DESCRIPTIONS: Record<PayrollCancellationReason, string> = {
  treasury_insufficient:
    "The batch was cancelled because the treasury could not cover the required amount. Top up the treasury and create a new batch.",
  approval_rejected:
    "An approver rejected this batch. Review the approval comments and correction requests before creating a replacement.",
  compliance_hold:
    "Compliance placed a hold on this batch. Resolve the compliance review before re-attempting.",
  duplicate_batch:
    "A duplicate batch for the same period/employees was detected. The older batch was cancelled to prevent double payment.",
  manual_request:
    "An operator manually cancelled this batch. No funds were moved.",
  expired_proof:
    "The ZK proof expired or failed verification. Generate a fresh proof for the next attempt.",
  unknown:
    "No specific cancellation reason was recorded. Check the audit timeline for additional context.",
};

export const CANCELLATION_AVAILABLE_ACTIONS: Record<PayrollCancellationReason, string[]> = {
  treasury_insufficient: ["Top up treasury", "Create replacement batch", "View funding forecast"],
  approval_rejected: ["Review approval comments", "Apply corrections", "Resubmit for approval"],
  compliance_hold: ["Review compliance evidence", "Contact compliance officer", "Create new batch after hold released"],
  duplicate_batch: ["View linked batch", "Verify period close status", "No action — already handled"],
  manual_request: ["View audit trail", "Clone batch as draft", "Archive cancelled run"],
  expired_proof: ["Generate new proof", "Verify proof expiry window", "Create replacement batch"],
  unknown: ["View audit trail", "Contact support", "Create replacement batch"],
};

export function getCancellationReason(run: PayrollRun): PayrollCancellationReason {
  if (run.status !== "cancelled") return "unknown";
  return run.cancellationReason ?? "unknown";
}

export function getCancellationSummary(run: PayrollRun): string {
  const reason = getCancellationReason(run);
  return CANCELLATION_REASON_LABELS[reason];
}

export function getCancellationDescription(run: PayrollRun): string {
  const reason = getCancellationReason(run);
  const detail = sanitizeCancellationDetail(run.cancellationDetail?.trim() ?? undefined);
  const base = CANCELLATION_REASON_DESCRIPTIONS[reason];
  return detail ? `${base} Detail: ${detail}` : base;
}

export function getAvailableActions(run: PayrollRun): string[] {
  const reason = getCancellationReason(run);
  return CANCELLATION_AVAILABLE_ACTIONS[reason];
}

/**
 * Privacy-safe check: ensure no private payroll values leak via cancellation detail.
 * Strips potential salary amounts, emails, or currency values before display.
 */
export function sanitizeCancellationDetail(detail?: string | null): string | undefined {
  if (!detail) return undefined;
  return detail
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\$\d{1,3}(,\d{3})*(\.\d+)?/g, "[REDACTED_AMOUNT]")
    .replace(/\b\d+(\.\d{1,7})?\s*(XLM|USDC|USD|EUR|BTC|ETH)\b/gi, "[REDACTED_AMOUNT]");
}

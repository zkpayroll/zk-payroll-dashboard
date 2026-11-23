/**
 * Partial treasury release failures (#760).
 *
 * A treasury release can pay out some reservations and fail others. The
 * operator needs to know how much went through, why the rest did not, and
 * what to do next. Only counts and reason codes are used — never recipients,
 * addresses or amounts.
 */

export type ReleaseFailureReason =
  | "insufficient_balance"
  | "destination_rejected"
  | "asset_unavailable"
  | "timeout"
  | "unknown";

export interface ReleaseFailureGroup {
  reason: ReleaseFailureReason | string;
  /** Number of reservations that failed for this reason. */
  count: number;
}

export interface PartialReleaseFailure {
  releaseId: string;
  /** Reservations the release tried to pay. */
  requested: number;
  /** Reservations that were released successfully. */
  released: number;
  failures: ReleaseFailureGroup[];
  occurredAt?: string | null;
}

export interface ReleaseFailureStep {
  reason: ReleaseFailureReason;
  count: number;
  label: string;
  nextStep: string;
  /** Whether retrying the failed items unchanged can succeed. */
  retryable: boolean;
}

const REASON_COPY: Record<ReleaseFailureReason, { label: string; nextStep: string; retryable: boolean }> = {
  insufficient_balance: {
    label: "Insufficient treasury balance",
    nextStep: "Fund the treasury, then retry the failed releases.",
    retryable: true,
  },
  destination_rejected: {
    label: "Destination rejected the payment",
    nextStep: "Review the destination details for the affected payouts, correct them, then retry.",
    retryable: false,
  },
  asset_unavailable: {
    label: "Asset unavailable",
    nextStep: "Check that the asset is enabled and funded for this company, then retry.",
    retryable: false,
  },
  timeout: {
    label: "Network timeout",
    nextStep: "Check the transaction status before retrying so nothing is paid twice, then retry.",
    retryable: true,
  },
  unknown: {
    label: "Unknown error",
    nextStep: "Check the incident log for this release and contact support if it persists.",
    retryable: false,
  },
};

export interface PartialReleaseSummary {
  releaseId: string;
  requested: number;
  released: number;
  failed: number;
  /** True only when something was released and something failed. */
  isPartial: boolean;
  steps: ReleaseFailureStep[];
  /** True when at least one failure group can be retried as is. */
  anyRetryable: boolean;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeReason(reason: unknown): ReleaseFailureReason {
  return typeof reason === "string" && reason in REASON_COPY ? (reason as ReleaseFailureReason) : "unknown";
}

export function summarizePartialRelease(failure: PartialReleaseFailure): PartialReleaseSummary {
  const grouped = new Map<ReleaseFailureReason, number>();
  for (const group of failure.failures ?? []) {
    const count = toCount(group?.count);
    if (count === 0) continue;
    const reason = normalizeReason(group.reason);
    grouped.set(reason, (grouped.get(reason) ?? 0) + count);
  }

  const steps: ReleaseFailureStep[] = Array.from(grouped.entries())
    .map(([reason, count]) => ({ reason, count, ...REASON_COPY[reason] }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const failedFromGroups = steps.reduce((sum, s) => sum + s.count, 0);
  const requested = toCount(failure.requested);
  const released = Math.min(toCount(failure.released), requested);
  // Trust the larger of the counted failures and the unaccounted remainder.
  const failed = Math.max(failedFromGroups, requested - released);

  return {
    releaseId: failure.releaseId,
    requested,
    released,
    failed,
    isPartial: released > 0 && failed > 0,
    steps,
    anyRetryable: steps.some((s) => s.retryable),
  };
}

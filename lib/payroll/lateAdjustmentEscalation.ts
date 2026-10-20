/**
 * Late payroll adjustment escalation (#683).
 *
 * `lib/sdk/amendments.ts` already flags an amendment as policy-invalid when
 * it falls outside the commitment-window policy (see `amd_policy_invalid_001`
 * — "Amendment window closed for period 2025-04"), but that is a hard block:
 * the operator's only path forward is to abandon the change. In practice a
 * payroll adjustment requested after a period has closed isn't always wrong
 * to allow — a shift supervisor correcting an underpaid contractor, or
 * finance fixing a data-entry error discovered during reconciliation, is
 * legitimate — it's just risky enough that it shouldn't go through on a
 * single standard approval the way an on-time adjustment would.
 *
 * This module is the pure escalation gate: given how late an adjustment
 * request is relative to the payroll policy's execution grace period, it
 * decides whether the request can proceed under normal approval or must be
 * escalated to a senior/executive reviewer, and why. It does not decide
 * whether the adjustment itself is valid — that stays with the amendment
 * validation module — only who must sign off on a *late* one.
 */

export type LateAdjustmentEscalationTier = "none" | "senior_review" | "executive_review";

export interface LateAdjustmentWindowPolicy {
  /**
   * Hours after a payroll period's close during which an adjustment is
   * still considered on-time. Mirrors `SettlementWindowPolicy.executionGracePeriodHours`.
   */
  executionGracePeriodHours: number;
  /**
   * Hours past the grace period after which lateness is severe enough to
   * require executive (not just senior) review. Defaults to 7 days.
   */
  executiveEscalationThresholdHours?: number;
}

export const DEFAULT_EXECUTIVE_ESCALATION_THRESHOLD_HOURS = 7 * 24;

export interface LateAdjustmentEscalationResult {
  /** Whether the adjustment request landed after the period's grace window. */
  isLate: boolean;
  /** How many hours past the grace window the request was made, floored at 0. */
  hoursLate: number;
  /** Who must review the request: nobody extra, a senior reviewer, or an executive. */
  escalationTier: LateAdjustmentEscalationTier;
  /** Privacy-safe, human-readable explanation for the UI/audit trail. */
  reason: string;
}

function hoursBetween(laterIso: string, earlierIso: string): number {
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
  return (later - earlier) / (60 * 60 * 1000);
}

/**
 * Evaluates whether a payroll adjustment requested at `requestedAt` for a
 * period that closed at `periodClosedAt` is late, and if so, which
 * escalation tier it requires before it can be approved.
 *
 * @param periodClosedAt ISO timestamp the payroll period/run closed.
 * @param requestedAt ISO timestamp the adjustment was requested.
 * @param policy Grace period and (optional) executive-escalation threshold.
 */
export function evaluateLateAdjustmentEscalation(
  periodClosedAt: string,
  requestedAt: string,
  policy: LateAdjustmentWindowPolicy,
): LateAdjustmentEscalationResult {
  const graceHours = Math.max(0, policy.executionGracePeriodHours);
  const executiveThresholdHours = Math.max(
    graceHours,
    policy.executiveEscalationThresholdHours ?? DEFAULT_EXECUTIVE_ESCALATION_THRESHOLD_HOURS,
  );

  const hoursSinceClose = hoursBetween(requestedAt, periodClosedAt);
  const hoursLate = Math.max(0, hoursSinceClose - graceHours);
  const isLate = hoursLate > 0;

  if (!isLate) {
    return {
      isLate: false,
      hoursLate: 0,
      escalationTier: "none",
      reason: "Adjustment requested within the standard execution grace period. No escalation required.",
    };
  }

  // `hoursLate` already excludes the grace period, so compare it directly
  // against how far past grace the executive threshold sits.
  const escalationTier: LateAdjustmentEscalationTier =
    hoursLate > executiveThresholdHours - graceHours ? "executive_review" : "senior_review";

  const roundedHoursLate = Math.round(hoursLate * 10) / 10;

  const reason =
    escalationTier === "executive_review"
      ? `Adjustment requested ${roundedHoursLate}h after the grace period closed — executive review is required before this can be approved.`
      : `Adjustment requested ${roundedHoursLate}h after the grace period closed — senior reviewer sign-off is required before this can be approved.`;

  return {
    isLate: true,
    hoursLate: roundedHoursLate,
    escalationTier,
    reason,
  };
}

/** Whether a given escalation tier permits a standard (non-escalated) approver to decide alone. */
export function requiresEscalatedReviewer(tier: LateAdjustmentEscalationTier): boolean {
  return tier !== "none";
}

/** Human label for an escalation tier, for the UI and audit trail. */
export function lateAdjustmentEscalationLabel(tier: LateAdjustmentEscalationTier): string {
  switch (tier) {
    case "executive_review":
      return "Executive Review Required";
    case "senior_review":
      return "Senior Review Required";
    case "none":
    default:
      return "Standard Review";
  }
}

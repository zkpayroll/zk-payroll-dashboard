/**
 * Treasury reservation recovery flow (#889).
 *
 * Decides which self-service recovery actions (Refresh, Revalidate, Cancel)
 * are available for a funding reservation, which one to recommend, and when
 * the operator must escalate to a treasury administrator. It also runs an
 * action against the reservations store and turns the outcome into an
 * actionable, privacy-safe message.
 *
 * Messages never include amounts, employee identifiers, wallet addresses or
 * salary data; they only name the action and the next step.
 */

import {
  RESERVATION_WARNING_WINDOW_MS,
  getReservationStatus,
  useReservationsStore,
  type FundingReservation,
  type ReservationActionFailureReason,
  type ReservationActionResult,
  type ReservationRecoveryAction,
  type ReservationStatus,
} from "@/stores/reservations";
import { parseReservationAmountUnits } from "@/lib/treasury/reservationGuidance";
import {
  cancelFundingReservation,
  updateFundingReservation,
} from "@/lib/events/reservationEvents";

export type {
  ReservationActionFailureReason,
  ReservationActionResult,
  ReservationRecoveryAction,
} from "@/stores/reservations";

export const RESERVATION_RECOVERY_ACTIONS: readonly ReservationRecoveryAction[] = [
  "refresh",
  "revalidate",
  "cancel",
] as const;

export const RESERVATION_RECOVERY_ACTION_LABELS: Record<ReservationRecoveryAction, string> = {
  refresh: "Refresh",
  revalidate: "Revalidate",
  cancel: "Cancel",
};

/**
 * - a recovery action: take that action next.
 * - `execute`:  the lock is still usable but cannot be extended; execute now.
 * - `escalate`: no self-service action can unblock the lock; contact an admin.
 * - `none`:     the lock is healthy; nothing to recover.
 */
export type ReservationRecoveryRecommendation =
  | ReservationRecoveryAction
  | "execute"
  | "escalate"
  | "none";

export interface ReservationRecoveryActionAvailability {
  action: ReservationRecoveryAction;
  enabled: boolean;
  /** Actionable explanation shown when `enabled` is false. */
  disabledReason?: string;
}

export interface ReservationRecoveryPlan {
  status: ReservationStatus;
  /** Amount, asset or expiry timestamp is malformed. */
  hasCorruptData: boolean;
  /** True when the reservation currently blocks payroll execution. */
  blocksExecution: boolean;
  recommendation: ReservationRecoveryRecommendation;
  requiresAdministrator: boolean;
  actions: Record<ReservationRecoveryAction, ReservationRecoveryActionAvailability>;
}

export const RESERVATION_RECOVERY_COPY = {
  refreshDisabled:
    "Refresh is disabled for this reservation by treasury policy.",
  revalidateDisabled:
    "Revalidate is disabled for this reservation by treasury policy.",
  cancelDisabled:
    "Cancel is disabled for this reservation. Contact a treasury administrator to release it.",
  renewInvalidData:
    "Cannot renew a reservation with an invalid amount or asset. Cancel it and create a new reservation.",
  success: {
    refresh:
      "Reservation refreshed. A new 15-minute execution window is active.",
    revalidate:
      "Reservation revalidated. Its reservation window was re-anchored to now for 15 minutes.",
    cancel:
      "Reservation cancelled and its hold released. Create a new reservation before executing payroll.",
  } satisfies Record<ReservationRecoveryAction, string>,
  failure: {
    invalid_id:
      "{action} failed: this reservation record has no valid identifier. Reload treasury state, then retry.",
    not_found:
      "{action} failed: this reservation is no longer tracked in this session. It may have been cancelled or replaced. Reload treasury state, then retry.",
    not_permitted:
      "{action} is not permitted for this reservation. Use another available recovery action or contact a treasury administrator.",
    invalid_data:
      "{action} failed: the reservation has an invalid amount or asset and cannot be renewed. Cancel it and create a new reservation.",
  } satisfies Record<ReservationActionFailureReason, string>,
} as const;

function hasValidTimestamp(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function hasValidAmountAndAsset(reservation: FundingReservation | null | undefined): boolean {
  if (!reservation) return false;
  const parsed = parseReservationAmountUnits(reservation.amount);
  const validAmount = parsed.ok && parsed.units > BigInt(0);
  const validAsset =
    typeof reservation.asset === "string" && reservation.asset.trim() !== "";
  return validAmount && validAsset;
}

function availability(
  action: ReservationRecoveryAction,
  enabled: boolean,
  disabledReason: string,
): ReservationRecoveryActionAvailability {
  return enabled ? { action, enabled } : { action, enabled, disabledReason };
}

/**
 * Build the recovery plan for one reservation. Fails closed: malformed
 * reservations are treated as expired and never recommended for renewal when
 * their amount or asset is corrupt.
 */
export function getReservationRecoveryPlan(
  reservation: FundingReservation | null | undefined,
  now: number = Date.now(),
  warningWindowMs: number = RESERVATION_WARNING_WINDOW_MS,
): ReservationRecoveryPlan {
  const metadataValid = hasValidAmountAndAsset(reservation);
  const timestampValid = hasValidTimestamp(reservation?.expiresAt);
  const hasCorruptData = !metadataValid || !timestampValid;
  const status: ReservationStatus = hasCorruptData
    ? "expired"
    : getReservationStatus(reservation, now, warningWindowMs);

  const canRefresh = reservation?.canRefresh === true;
  const canRevalidate = reservation?.canRevalidate === true;
  const canCancel = reservation?.canCancel === true;

  const actions: ReservationRecoveryPlan["actions"] = {
    refresh: availability(
      "refresh",
      canRefresh && metadataValid,
      canRefresh ? RESERVATION_RECOVERY_COPY.renewInvalidData : RESERVATION_RECOVERY_COPY.refreshDisabled,
    ),
    revalidate: availability(
      "revalidate",
      canRevalidate && metadataValid,
      canRevalidate
        ? RESERVATION_RECOVERY_COPY.renewInvalidData
        : RESERVATION_RECOVERY_COPY.revalidateDisabled,
    ),
    cancel: availability("cancel", canCancel, RESERVATION_RECOVERY_COPY.cancelDisabled),
  };

  let recommendation: ReservationRecoveryRecommendation;
  if (status === "healthy") {
    recommendation = "none";
  } else if (actions.refresh.enabled) {
    recommendation = "refresh";
  } else if (actions.revalidate.enabled) {
    recommendation = "revalidate";
  } else if (status === "warning") {
    recommendation = "execute";
  } else if (actions.cancel.enabled) {
    recommendation = "cancel";
  } else {
    recommendation = "escalate";
  }

  return {
    status,
    hasCorruptData,
    blocksExecution: status === "expired",
    recommendation,
    requiresAdministrator: recommendation === "escalate",
    actions,
  };
}

export interface ReservationRecoverySummary {
  total: number;
  blocking: number;
  /** Blocking reservations that a self-service action here can clear. */
  selfServiceRecoverable: number;
  /** Blocking reservations that need a treasury administrator. */
  needsAdministrator: number;
  canExecutePayroll: boolean;
}

/** Aggregate recovery progress across a set of reservations. */
export function summarizeReservationRecovery(
  reservations: Array<FundingReservation | null | undefined> | null | undefined,
  now: number = Date.now(),
  warningWindowMs: number = RESERVATION_WARNING_WINDOW_MS,
): ReservationRecoverySummary {
  const list = Array.isArray(reservations) ? reservations : [];
  let blocking = 0;
  let selfServiceRecoverable = 0;
  let needsAdministrator = 0;
  for (const reservation of list) {
    const plan = getReservationRecoveryPlan(reservation, now, warningWindowMs);
    if (!plan.blocksExecution) continue;
    blocking += 1;
    if (plan.requiresAdministrator) needsAdministrator += 1;
    else selfServiceRecoverable += 1;
  }
  return {
    total: list.length,
    blocking,
    selfServiceRecoverable,
    needsAdministrator,
    canExecutePayroll: blocking === 0,
  };
}

export interface ReservationActionMessage {
  tone: "success" | "error";
  message: string;
}

/** Turn an action result into an actionable, privacy-safe operator message. */
export function describeReservationActionResult(
  result: ReservationActionResult,
): ReservationActionMessage {
  if (result.ok) {
    return { tone: "success", message: RESERVATION_RECOVERY_COPY.success[result.action] };
  }
  const label = RESERVATION_RECOVERY_ACTION_LABELS[result.action];
  return {
    tone: "error",
    message: RESERVATION_RECOVERY_COPY.failure[result.reason].replace("{action}", label),
  };
}

export interface RunReservationRecoveryOptions {
  /** Record the outcome on the reservation timeline (default true). */
  recordTimelineEvent?: boolean;
}

const TIMELINE_SUMMARY: Record<Exclude<ReservationRecoveryAction, "cancel">, string> = {
  refresh: "Reservation refreshed with a new 15-minute execution window",
  revalidate: "Reservation revalidated and its window re-anchored",
};

/**
 * Run a recovery action against the reservations store.
 *
 * Unlike calling the store directly, this refuses to renew a reservation whose
 * amount or asset is corrupt (`invalid_data`), and records successful actions
 * on the reservation timeline so operators can audit recovery.
 */
export function runReservationRecoveryAction(
  action: ReservationRecoveryAction,
  reservationId: string,
  { recordTimelineEvent = true }: RunReservationRecoveryOptions = {},
): ReservationActionResult {
  const store = useReservationsStore.getState();

  if (action !== "cancel" && typeof reservationId === "string") {
    const reservation = store.getReservation(reservationId);
    if (reservation && !hasValidAmountAndAsset(reservation)) {
      const flag = action === "refresh" ? reservation.canRefresh : reservation.canRevalidate;
      if (flag === true) return { ok: false, action, reason: "invalid_data" };
    }
  }

  const result =
    action === "refresh"
      ? store.refreshReservation(reservationId)
      : action === "revalidate"
        ? store.revalidateReservation(reservationId)
        : store.cancelReservation(reservationId);

  if (result.ok && recordTimelineEvent) {
    try {
      if (result.action === "cancel") {
        cancelFundingReservation(result.reservationId, "operator recovery action");
      } else {
        updateFundingReservation(result.reservationId, {
          summary: TIMELINE_SUMMARY[result.action],
        });
      }
    } catch {
      // Timeline logging must never undo or mask a successful recovery.
    }
  }

  return result;
}

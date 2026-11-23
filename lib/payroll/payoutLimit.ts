/**
 * Payout count vs. the per-batch recipient limit (#542).
 *
 * The capacity policy's `maxBatchSize` caps how many employees one payroll
 * batch (one ZK proof) may pay. This computes how close a run is to that cap
 * so the review step can warn early and block runs that exceed it.
 */

export type PayoutLimitState = "ok" | "near" | "at" | "over" | "unconfigured";

export interface PayoutLimitStatus {
  state: PayoutLimitState;
  count: number;
  limit: number;
  /** Payouts still available before the limit (0 when at/over). */
  remaining: number;
  /** Share of the limit used, 0-100 (capped at 100 for display). */
  percent: number;
  /** Batches needed to pay everyone without exceeding the limit. */
  batchesNeeded: number;
  /** True when the run cannot proceed as a single batch. */
  blocking: boolean;
}

/** Warn once a run uses this share of the limit. */
export const PAYOUT_LIMIT_WARN_RATIO = 0.8;

export function getPayoutLimitStatus(count: number, limit: number): PayoutLimitStatus {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (!Number.isFinite(limit) || limit < 1) {
    return {
      state: "unconfigured",
      count: safeCount,
      limit: 0,
      remaining: 0,
      percent: 0,
      batchesNeeded: safeCount > 0 ? 1 : 0,
      blocking: false,
    };
  }
  const cap = Math.floor(limit);
  const ratio = safeCount / cap;
  const state: PayoutLimitState =
    safeCount > cap ? "over" : safeCount === cap ? "at" : ratio >= PAYOUT_LIMIT_WARN_RATIO ? "near" : "ok";

  return {
    state,
    count: safeCount,
    limit: cap,
    remaining: Math.max(0, cap - safeCount),
    percent: Math.min(100, Math.round(ratio * 100)),
    batchesNeeded: safeCount === 0 ? 0 : Math.ceil(safeCount / cap),
    blocking: state === "over",
  };
}

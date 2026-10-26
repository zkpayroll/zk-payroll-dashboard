/**
 * Payout batch size vs. the payroll contract's per-submission limit (#752).
 *
 * `maxBatchSize` in the capacity policy is the operator's own cap. The
 * contract enforces a separate, lower cap on how many payout entries one
 * submission may carry (`CONTRACT_MAX_PAYOUT_BATCH_SIZE` in the SDK's
 * `batch/contractBatchLimit`). A run above it is still valid, but must go out
 * as several submissions, so operators are warned before they sign.
 * Only counts are used here — never names, addresses or amounts.
 */

/** Mirrors the SDK's `CONTRACT_MAX_PAYOUT_BATCH_SIZE`. */
export const CONTRACT_MAX_PAYOUT_BATCH_SIZE = 50;

/** Warn once a run uses this share of the contract limit. */
export const CONTRACT_LIMIT_WARN_RATIO = 0.8;

export type ContractBatchLimitState = "ok" | "near" | "at" | "exceeds";

export interface ContractBatchLimitStatus {
  state: ContractBatchLimitState;
  count: number;
  /** The contract limit that was applied. */
  limit: number;
  /** Payout entries still available in one submission (0 when at/over). */
  remaining: number;
  /** On-chain submissions needed to pay everyone within the limit. */
  submissionsNeeded: number;
  /** Payouts over the limit for a single submission (0 when within it). */
  excess: number;
  /** True when the saved capacity policy allows more than the contract does. */
  policyAboveContractLimit: boolean;
}

export function getContractBatchLimitStatus(
  count: number,
  policyMaxBatchSize?: number | null,
  limit: number = CONTRACT_MAX_PAYOUT_BATCH_SIZE
): ContractBatchLimitStatus {
  const cap = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : CONTRACT_MAX_PAYOUT_BATCH_SIZE;
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const state: ContractBatchLimitState =
    safeCount > cap
      ? "exceeds"
      : safeCount === cap
        ? "at"
        : safeCount / cap >= CONTRACT_LIMIT_WARN_RATIO
          ? "near"
          : "ok";

  return {
    state,
    count: safeCount,
    limit: cap,
    remaining: Math.max(0, cap - safeCount),
    submissionsNeeded: safeCount === 0 ? 0 : Math.ceil(safeCount / cap),
    excess: Math.max(0, safeCount - cap),
    policyAboveContractLimit:
      typeof policyMaxBatchSize === "number" &&
      Number.isFinite(policyMaxBatchSize) &&
      policyMaxBatchSize > cap,
  };
}

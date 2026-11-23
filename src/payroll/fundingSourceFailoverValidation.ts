/**
 * Funding source failover validation (#691).
 *
 * Enforces policy and health checks before switching a payroll run's disbursement
 * funding source from a degraded or depleted primary source to a secondary/standby
 * source. Prevents disbursement failures, asset mismatches, and unauthorized failovers.
 *
 * Privacy guarantees: Evaluates only asset IDs, balance capacities, and status flags.
 * Never reads or exposes individual employee salaries or contributor records.
 */

export type FundingSourceStatus = "active" | "suspended" | "maintenance" | "depleted";

export type FundingSourceType =
  | "hot_wallet"
  | "multisig_vault"
  | "liquidity_pool"
  | "custodial_reserve";

export interface FundingSource {
  id: string;
  label: string;
  sourceType: FundingSourceType;
  assetCode: string;
  availableBalance: number;
  status: FundingSourceStatus;
  priorityTier: number; // Lower numbers have higher priority (1 is highest)
  lastFailoverTimestamp?: number;
}

export interface FailoverPolicy {
  /** Additional reserve buffer percentage (e.g., 0.05 for 5% buffer). */
  bufferPercentage: number;
  /** Maximum amount that can failover automatically without explicit operator confirmation. */
  maxAutomaticFailoverLimit: number;
  /** Cooldown in seconds before a source can be selected for failover again. */
  cooldownPeriodSeconds: number;
  /** Whether amounts exceeding maxAutomaticFailoverLimit strictly require confirmation. */
  requireOperatorConfirmationAboveLimit: boolean;
}

export const DEFAULT_FAILOVER_POLICY: FailoverPolicy = {
  bufferPercentage: 0.05, // 5%
  maxAutomaticFailoverLimit: 50_000,
  cooldownPeriodSeconds: 3600, // 1 hour
  requireOperatorConfirmationAboveLimit: true,
};

export interface FailoverEvaluationContext {
  payrollRunId: string;
  requiredAmount: number;
  requiredAssetCode: string;
  primarySourceId: string;
  now?: number;
  operatorConfirmed?: boolean;
}

export type FailoverRejectionReason =
  | "ineligible_source"
  | "asset_mismatch"
  | "insufficient_funds"
  | "cooldown_active"
  | "authorization_required"
  | "no_candidates";

export interface CandidateEvaluation {
  id: string;
  eligible: boolean;
  reason?: FailoverRejectionReason;
  message?: string;
}

export interface FailoverValidationResult {
  isValid: boolean;
  selectedSource?: FundingSource;
  rejectionReason?: FailoverRejectionReason;
  message: string;
  requiredTotalWithBuffer: number;
  evaluatedCandidates: CandidateEvaluation[];
}

/**
 * Validates whether a single candidate funding source qualifies for failover.
 */
export function validateSingleFailoverCandidate(
  candidate: FundingSource,
  context: FailoverEvaluationContext,
  policy: FailoverPolicy = DEFAULT_FAILOVER_POLICY,
): { eligible: boolean; reason?: FailoverRejectionReason; message?: string } {
  const now = context.now ?? Date.now();

  if (candidate.id === context.primarySourceId) {
    return {
      eligible: false,
      reason: "ineligible_source",
      message: "Failover candidate cannot be the current primary source.",
    };
  }

  if (candidate.status !== "active") {
    return {
      eligible: false,
      reason: "ineligible_source",
      message: `Candidate ${candidate.label} is currently '${candidate.status}'.`,
    };
  }

  if (candidate.assetCode.toUpperCase() !== context.requiredAssetCode.toUpperCase()) {
    return {
      eligible: false,
      reason: "asset_mismatch",
      message: `Asset mismatch: candidate has ${candidate.assetCode}, required ${context.requiredAssetCode}.`,
    };
  }

  const requiredWithBuffer = context.requiredAmount * (1 + policy.bufferPercentage);
  if (candidate.availableBalance < requiredWithBuffer) {
    return {
      eligible: false,
      reason: "insufficient_funds",
      message: `Insufficient balance on ${candidate.label}: available ${candidate.availableBalance}, required ${requiredWithBuffer}.`,
    };
  }

  if (candidate.lastFailoverTimestamp) {
    const elapsedSeconds = Math.floor((now - candidate.lastFailoverTimestamp) / 1000);
    if (elapsedSeconds < policy.cooldownPeriodSeconds) {
      const remainingCooldown = policy.cooldownPeriodSeconds - elapsedSeconds;
      return {
        eligible: false,
        reason: "cooldown_active",
        message: `Candidate ${candidate.label} is in cooldown for another ${remainingCooldown}s.`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Evaluates candidate funding sources in priority rank order and selects the best eligible source.
 */
export function selectAndValidateFailoverSource(
  candidates: FundingSource[],
  context: FailoverEvaluationContext,
  policy: FailoverPolicy = DEFAULT_FAILOVER_POLICY,
): FailoverValidationResult {
  const requiredWithBuffer = context.requiredAmount * (1 + policy.bufferPercentage);

  if (
    policy.requireOperatorConfirmationAboveLimit &&
    context.requiredAmount > policy.maxAutomaticFailoverLimit &&
    !context.operatorConfirmed
  ) {
    return {
      isValid: false,
      rejectionReason: "authorization_required",
      message: `Failover amount (${context.requiredAmount}) exceeds the automatic threshold (${policy.maxAutomaticFailoverLimit}). Explicit operator confirmation is required.`,
      requiredTotalWithBuffer: requiredWithBuffer,
      evaluatedCandidates: [],
    };
  }

  const evaluatedCandidates: CandidateEvaluation[] = candidates.map((candidate) => {
    const evaluation = validateSingleFailoverCandidate(candidate, context, policy);
    return {
      id: candidate.id,
      eligible: evaluation.eligible,
      reason: evaluation.reason,
      message: evaluation.message,
    };
  });

  const eligibleCandidates = candidates.filter(
    (c) => evaluatedCandidates.find((e) => e.id === c.id)?.eligible,
  );

  if (eligibleCandidates.length === 0) {
    return {
      isValid: false,
      rejectionReason: "no_candidates",
      message: "No eligible standby funding sources met liquidity, asset, and health criteria.",
      requiredTotalWithBuffer: requiredWithBuffer,
      evaluatedCandidates,
    };
  }

  // Sort by priority tier ascending (1 before 2), then availableBalance descending
  eligibleCandidates.sort((a, b) => {
    if (a.priorityTier !== b.priorityTier) {
      return a.priorityTier - b.priorityTier;
    }
    return b.availableBalance - a.availableBalance;
  });

  const selectedSource = eligibleCandidates[0];

  return {
    isValid: true,
    selectedSource,
    message: `Selected failover source ${selectedSource.label} (Tier ${selectedSource.priorityTier}) with sufficient liquidity.`,
    requiredTotalWithBuffer: requiredWithBuffer,
    evaluatedCandidates,
  };
}

export class FundingSourceFailoverValidationError extends Error {
  result: FailoverValidationResult;

  constructor(result: FailoverValidationResult) {
    super(result.message);
    this.name = "FundingSourceFailoverValidationError";
    this.result = result;
  }
}

/**
 * Asserts that a valid failover source is available and selected.
 */
export function assertFundingFailoverValid(
  candidates: FundingSource[],
  context: FailoverEvaluationContext,
  policy: FailoverPolicy = DEFAULT_FAILOVER_POLICY,
): FundingSource {
  const result = selectAndValidateFailoverSource(candidates, context, policy);
  if (!result.isValid || !result.selectedSource) {
    throw new FundingSourceFailoverValidationError(result);
  }
  return result.selectedSource;
}

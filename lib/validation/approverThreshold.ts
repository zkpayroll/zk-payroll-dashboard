export interface ThresholdValidationResult {
  isValid: boolean;
  message: string | null;
}

const MAX_REASONABLE_THRESHOLD = 20;

/**
 * Validates a proposed approver threshold. A threshold must be a positive
 * integer, cannot exceed a sane operational ceiling, and rotating to the
 * same value as the current policy is rejected as a no-op change.
 */
export function validateApproverThreshold(
  proposed: number,
  currentRequiredApprovals: number,
): ThresholdValidationResult {
  if (!Number.isInteger(proposed) || proposed < 1) {
    return { isValid: false, message: "Threshold must be a whole number of at least 1." };
  }

  if (proposed > MAX_REASONABLE_THRESHOLD) {
    return {
      isValid: false,
      message: `Threshold cannot exceed ${MAX_REASONABLE_THRESHOLD} approvers.`,
    };
  }

  if (proposed === currentRequiredApprovals) {
    return { isValid: false, message: "Proposed threshold matches the current policy — no change to submit." };
  }

  return { isValid: true, message: null };
}

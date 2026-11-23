/**
 * Payout destination change review module (#596).
 *
 * Provides domain-level review logic, reason code formatting, and privacy-safe
 * review evaluations for employee payout destination updates before payroll runs.
 *
 * Privacy guarantees:
 * - Wallet addresses are masked by default (`GDQP2K…4W37`).
 * - No employee salary amounts, private keys, or financial commitments are handled.
 * - Actionable validation errors indicate operational blockers without leaking PII.
 */

import {
  validatePayoutDestinationChangeApproval,
  validatePayoutDestinationChangeRejection,
  validateDestinationAddress,
  type PayoutDestinationChangeApprovalInput,
  type PayoutDestinationChangeValidationResult,
} from "@/lib/validation/payoutDestination";
import { maskAddress } from "@/stores/walletRotation";
import type {
  WalletRotationRequest,
  WalletRotationReasonCode,
} from "@/types";

export const PAYOUT_DESTINATION_REASON_LABELS: Record<WalletRotationReasonCode, string> = {
  scheduled_rotation: "Scheduled Rotation",
  key_compromise: "Key Compromise",
  device_loss: "Device Loss",
  compliance_requirement: "Compliance Requirement",
  emergency: "Emergency",
};

export interface PayoutDestinationReviewEvaluation {
  canApprove: boolean;
  canReject: boolean;
  approvalError: string | null;
  maskedPrevious: string;
  maskedNew: string;
  reasonLabel: string;
  isEmergency: boolean;
}

/**
 * Pure helper to evaluate a payout destination change request against operational rules.
 */
export function evaluatePayoutDestinationChange(
  request: WalletRotationRequest,
  isCooldownActive: boolean = false,
): PayoutDestinationReviewEvaluation {
  const approvalValidation = validatePayoutDestinationChangeApproval({
    status: request.status,
    previousWallet: request.previousWallet,
    newWallet: request.newWallet,
    isCooldownActive,
  });

  return {
    canApprove: approvalValidation.isValid,
    canReject: request.status === "pending",
    approvalError: approvalValidation.error,
    maskedPrevious: maskAddress(request.previousWallet || ""),
    maskedNew: maskAddress(request.newWallet || ""),
    reasonLabel: PAYOUT_DESTINATION_REASON_LABELS[request.reasonCode] || "Destination Update",
    isEmergency: !!request.isEmergency,
  };
}

export {
  validatePayoutDestinationChangeApproval,
  validatePayoutDestinationChangeRejection,
  validateDestinationAddress,
  type PayoutDestinationChangeApprovalInput,
  type PayoutDestinationChangeValidationResult,
};

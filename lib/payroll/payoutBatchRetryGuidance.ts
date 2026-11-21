/**
 * Payout batch retry guidance module.
 *
 * Provides actionable, privacy-safe guidance for payout batch retries across
 * dashboard views. Evaluates batch state, attempt thresholds, contract pause
 * flags, company active status, and settlement history to inform operators
 * whether a retry is safe, why a retry is blocked or deferred, and what exact
 * steps should be taken next.
 *
 * Privacy guarantee:
 * Never inspects or leaks employee identities, salary values, wallet addresses,
 * or cryptographic secrets. Only opaque identifiers, timestamps, counts, and
 * status flags are evaluated.
 */

export type RetryDecisionOutcome = "allowed" | "blocked" | "deferred";

export type PayoutBatchRetryReasonCode =
  | "CONTRACT_PAUSED"
  | "ALREADY_SETTLED"
  | "COMPANY_INACTIVE"
  | "RUN_CANCELLED"
  | "TREASURY_INSUFFICIENT"
  | "APPROVAL_REJECTED"
  | "COMPLIANCE_HOLD"
  | "EXPIRED_PROOF"
  | "DUPLICATE_BATCH"
  | "RECONCILIATION_FAILED"
  | "DISCREPANCIES_FOUND"
  | "MAX_ATTEMPTS_EXCEEDED"
  | "RETRY_WITHIN_POLICY";

export interface PayoutBatchRetryGuidance {
  payrollId: string;
  outcome: RetryDecisionOutcome;
  reason: PayoutBatchRetryReasonCode;
  attempt: number;
  maxAttempts: number;
  remainingAttempts: number;
  title: string;
  message: string;
  guidance: string;
  nextSteps: string[];
  remediationHref?: string;
  remediationLabel?: string;
  canRetry: boolean;
}

export interface PayoutBatchRetryEvaluationInput {
  payrollId: string;
  attempt?: number;
  maxAttempts?: number;
  isMutationDisabled?: boolean;
  pauseReason?: string | null;
  hasInactiveCompany?: boolean;
  isSettled?: boolean;
  receiptId?: string | null;
  transactionHash?: string | null;
  status?: string | null;
  cancellationReason?: string | null;
  reconciliationStatus?: string | null;
  discrepancies?: string[] | null;
}

export const DEFAULT_PAYOUT_BATCH_MAX_RETRIES = 3;

export const RETRY_DECISION_OUTCOME_LABELS: Record<RetryDecisionOutcome, string> = {
  allowed: "Retry permitted",
  blocked: "Retry blocked",
  deferred: "Retry deferred",
};

/**
 * Evaluates payout batch retry eligibility and returns actionable operator guidance.
 * Pure function: never throws, never mutates inputs, safe with untrusted data.
 */
export function evaluatePayoutBatchRetryGuidance(
  input: PayoutBatchRetryEvaluationInput,
): PayoutBatchRetryGuidance {
  const payrollId = input.payrollId || "unknown-payroll";
  const maxAttempts =
    typeof input.maxAttempts === "number" && input.maxAttempts > 0
      ? Math.floor(input.maxAttempts)
      : DEFAULT_PAYOUT_BATCH_MAX_RETRIES;
  const rawAttempt =
    typeof input.attempt === "number" && input.attempt > 0
      ? Math.floor(input.attempt)
      : 1;

  // 1. Contract Paused Check (Highest priority blocker)
  if (input.isMutationDisabled) {
    const pauseDetail = input.pauseReason
      ? ` Smart contract pause reason: ${input.pauseReason}.`
      : "";
    return {
      payrollId,
      outcome: "blocked",
      reason: "CONTRACT_PAUSED",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Smart Contracts Paused — Mutation Actions Disabled",
      message: `Payroll contract operations are currently paused by administrative action.${pauseDetail} Mutation actions and payout retries are suspended.`,
      guidance:
        "Review pause status in Admin Settings. Mutation actions, approvals, and batch retries are disabled until contracts are resumed.",
      nextSteps: [
        "Review contract pause status in Admin Settings",
        "Wait for administrative resumption of smart contracts",
        "Do not submit batch retry requests while contracts are paused",
      ],
      remediationHref: "/admin",
      remediationLabel: "Review Pause Status in Admin Settings",
      canRetry: false,
    };
  }

  // 2. Already Settled / On-Chain Receipt Check (Duplicate payout prevention)
  const isSettled =
    Boolean(input.isSettled) ||
    Boolean(input.receiptId) ||
    input.status === "verified" ||
    (Boolean(input.transactionHash) &&
      input.status !== "pending" &&
      input.status !== "failed");

  if (isSettled) {
    return {
      payrollId,
      outcome: "blocked",
      reason: "ALREADY_SETTLED",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: 0,
      title: "Batch Already Settled On-Chain",
      message:
        "This payout batch has already settled or contains verified on-chain confirmation receipts.",
      guidance:
        "Retry blocked — this payout already has a settlement receipt. Retrying is prohibited to prevent duplicate disbursements to recipients.",
      nextSteps: [
        "Verify on-chain settlement details in Transaction History",
        "Do not re-queue or retry already settled transactions",
        "Export audit logs if settlement reconciliation is required",
      ],
      remediationHref: "/history",
      remediationLabel: "View Settlement History",
      canRetry: false,
    };
  }

  // 3. Inactive Company Profile Check (#762)
  if (input.hasInactiveCompany) {
    return {
      payrollId,
      outcome: "blocked",
      reason: "COMPANY_INACTIVE",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Inactive Company Reference Detected",
      message:
        "The payroll run references an inactive or archived company profile.",
      guidance:
        "Payout execution and batch retries are restricted until the referenced company profile is reactivated.",
      nextSteps: [
        "Reactivate the company profile in Company Settings or switch company context",
        "Verify administrative signing authority and smart contract configuration",
        "Ensure all organization compliance requirements are satisfied before retrying",
      ],
      remediationHref: "/company/switch",
      remediationLabel: "Switch Company Context",
      canRetry: false,
    };
  }

  // 4. Cancelled Run Check
  if (input.status === "cancelled" || input.cancellationReason === "manual_request") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "RUN_CANCELLED",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: 0,
      title: "Payroll Run Cancelled",
      message:
        "This payroll run was cancelled on request and cannot be processed further.",
      guidance:
        "Cancelled payroll runs cannot be retried. Create a new draft batch to initiate a new disbursement.",
      nextSteps: [
        "Create a new draft batch in Payroll Operations",
        "Re-verify recipient roster and compensation parameters",
      ],
      remediationHref: "/payroll/create",
      remediationLabel: "Create Draft Batch",
      canRetry: false,
    };
  }

  // 5. Specific Cancellation / Failure Reasons
  if (input.cancellationReason === "treasury_insufficient") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "TREASURY_INSUFFICIENT",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Insufficient Treasury Funds",
      message:
        "The treasury balance does not hold sufficient liquidity to complete this payout batch.",
      guidance:
        "Replenish treasury liquidity before re-attempting this batch. Retrying without adequate funds will fail again.",
      nextSteps: [
        "Review Treasury balance and deposit required funds",
        "Re-run treasury readiness check once funded",
      ],
      remediationHref: "/treasury",
      remediationLabel: "Fund Treasury",
      canRetry: false,
    };
  }

  if (input.cancellationReason === "approval_rejected") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "APPROVAL_REJECTED",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Approval Rejected",
      message:
        "This payout batch was rejected during the multi-sig approval stage.",
      guidance:
        "A rejected payout batch requires a fresh approval submission before it can proceed.",
      nextSteps: [
        "Review rejection notes in the Approval Queue",
        "Submit draft for new approval sign-off",
      ],
      remediationHref: "/payroll/approvals",
      remediationLabel: "Review Approval Queue",
      canRetry: false,
    };
  }

  if (input.cancellationReason === "compliance_hold") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "COMPLIANCE_HOLD",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Compliance Hold Active",
      message:
        "A compliance hold is currently blocking this payout batch.",
      guidance:
        "Resolve active compliance flags and verification holds before attempting to retry this batch.",
      nextSteps: [
        "Review compliance exceptions in Compliance center",
        "Resolve pending audit flags before releasing batch",
      ],
      remediationHref: "/compliance",
      remediationLabel: "Review Compliance",
      canRetry: false,
    };
  }

  if (input.cancellationReason === "expired_proof") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "EXPIRED_PROOF",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - rawAttempt),
      title: "Zero-Knowledge Proof Expired",
      message:
        "The zero-knowledge cryptographic proof for this payout batch has expired.",
      guidance:
        "Generate a fresh zero-knowledge proof before retrying execution.",
      nextSteps: [
        "Open Execute wizard to generate a new proof",
        "Verify proof validity before re-submitting to chain",
      ],
      remediationHref: "/payroll/execute",
      remediationLabel: "Generate Fresh Proof",
      canRetry: false,
    };
  }

  if (input.cancellationReason === "duplicate_batch") {
    return {
      payrollId,
      outcome: "blocked",
      reason: "DUPLICATE_BATCH",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: 0,
      title: "Duplicate Batch Detected",
      message:
        "This payout batch has commitments matching an existing submitted batch.",
      guidance:
        "Duplicate batches cannot be retried. Verify past transaction records to prevent double payouts.",
      nextSteps: [
        "Review history for existing confirmed batches",
        "Archive duplicate batch draft",
      ],
      remediationHref: "/history",
      remediationLabel: "Inspect History",
      canRetry: false,
    };
  }

  // 6. Max Attempts Exceeded Check
  if (rawAttempt > maxAttempts) {
    return {
      payrollId,
      outcome: "deferred",
      reason: "MAX_ATTEMPTS_EXCEEDED",
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts: 0,
      title: "Maximum Retry Limit Reached",
      message: `Adjustment and retry limit reached (${rawAttempt - 1} attempts made, maximum allowed: ${maxAttempts}).`,
      guidance:
        `Retry attempts exhausted (${maxAttempts} of ${maxAttempts} used). Automated retries are deferred to protect payroll integrity. Contact an approver or administrator to investigate or request a new batch.`,
      nextSteps: [
        "Investigate reconciliation discrepancy reports",
        "Contact an approver to request a new batch",
        "Do not attempt further automated retries for this batch",
      ],
      remediationHref: "/payroll/reconciliation",
      remediationLabel: "Review Reconciliation Details",
      canRetry: false,
    };
  }

  // 7. Reconciliation Discrepancies / Failure
  const hasDiscrepancies =
    Array.isArray(input.discrepancies) && input.discrepancies.length > 0;
  if (input.reconciliationStatus === "failed" || hasDiscrepancies) {
    const remainingAttempts = Math.max(0, maxAttempts - rawAttempt);
    const reason: PayoutBatchRetryReasonCode = hasDiscrepancies
      ? "DISCREPANCIES_FOUND"
      : "RECONCILIATION_FAILED";

    return {
      payrollId,
      outcome: "allowed",
      reason,
      attempt: rawAttempt,
      maxAttempts,
      remainingAttempts,
      title: hasDiscrepancies
        ? "Discrepancies Found During Reconciliation"
        : "Reconciliation Reported Failure",
      message:
        "Reconciliation encountered issues on this payout batch. The run can be safely re-queued for retry.",
      guidance: `Retry permitted (${remainingAttempts} attempt(s) remaining). Review reconciliation discrepancy details, then re-queue the run for settlement.`,
      nextSteps: [
        "Inspect reconciliation diff details",
        "Confirm recipient commitments match latest ledger state",
        "Re-queue payout batch for settlement",
      ],
      remediationHref: "/payroll/reconciliation",
      remediationLabel: "Review Reconciliation Details",
      canRetry: true,
    };
  }

  // 8. Default Allowed: Retry Permitted Within Policy
  const remainingAttempts = Math.max(0, maxAttempts - rawAttempt);
  return {
    payrollId,
    outcome: "allowed",
    reason: "RETRY_WITHIN_POLICY",
    attempt: rawAttempt,
    maxAttempts,
    remainingAttempts,
    title: "Retry Permitted Within Policy",
    message: `Payout batch retry attempt ${rawAttempt} of ${maxAttempts} is permitted.`,
    guidance: `Retry is permitted within policy (${remainingAttempts} attempt(s) remaining). Re-queuing will re-submit the payout batch safely without exposing employee salaries or private keys.`,
    nextSteps: [
      "Confirm batch parameters are current",
      "Proceed with batch retry submission",
      "Monitor on-chain confirmation status",
    ],
    canRetry: true,
  };
}

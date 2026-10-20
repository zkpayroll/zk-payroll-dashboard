/**
 * Outlier payment investigation workflow (#719).
 *
 * Detects and manages investigation workflows for payments that deviate
 * significantly from expected patterns or historical norms. Provides
 * structured investigation steps, validation gates, and audit trails
 * for anomalous payment activities.
 *
 * Privacy guarantees: Raw employee identities and salary data are never logged
 * or exposed. Payment amounts are masked in user-facing status messages.
 */

export type OutlierPaymentStatus = "detected" | "under_investigation" | "cleared" | "flagged" | "resolved";

export type InvestigationStepType = "initial_review" | "pattern_analysis" | "operator_verification" | "resolution_approval";

export interface OutlierPaymentPolicy {
  deviationThresholdPercent: number;
  requirePatternAnalysis: boolean;
  requireOperatorVerification: boolean;
  investigationTtlSeconds: number;
}

export const DEFAULT_OUTLIER_POLICY: OutlierPaymentPolicy = {
  deviationThresholdPercent: 25,
  requirePatternAnalysis: true,
  requireOperatorVerification: true,
  investigationTtlSeconds: 604800, // 7 days
};

export interface OutlierPayment {
  id: string;
  payrollRunId: string;
  employeeRef: string;
  deviationPercent: number;
  status: OutlierPaymentStatus;
  detectedAt: number;
  completedSteps: InvestigationStepType[];
  investigationNotes?: string;
  resolvedAt?: number;
  resolutionReason?: string;
}

export interface CreateOutlierPaymentInput {
  id: string;
  payrollRunId: string;
  employeeRef: string;
  deviationPercent: number;
  now?: number;
  policy?: Partial<OutlierPaymentPolicy>;
}

export interface OutlierPaymentEvaluation {
  isOutlier: boolean;
  status: OutlierPaymentStatus;
  message: string;
  missingSteps: InvestigationStepType[];
  requiresApproval: boolean;
}

/**
 * Creates a new outlier payment record in detected status.
 */
export function createOutlierPayment(input: CreateOutlierPaymentInput): OutlierPayment {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Outlier payment id must be provided");
  }
  if (!input.payrollRunId || input.payrollRunId.trim().length === 0) {
    throw new Error("Payroll run id must be provided");
  }
  if (!input.employeeRef || input.employeeRef.trim().length === 0) {
    throw new Error("Employee reference must be provided");
  }
  if (input.deviationPercent < 0) {
    throw new Error("Deviation percent cannot be negative");
  }

  const policy = { ...DEFAULT_OUTLIER_POLICY, ...input.policy };

  return {
    id: input.id.trim(),
    payrollRunId: input.payrollRunId.trim(),
    employeeRef: input.employeeRef.trim(),
    deviationPercent: input.deviationPercent,
    status: "detected",
    detectedAt: input.now ?? Date.now(),
    completedSteps: [],
  };
}

/**
 * Submits an investigation step for an outlier payment.
 */
export function submitInvestigationStep(
  payment: OutlierPayment,
  step: InvestigationStepType,
  operatorId: string,
  now = Date.now(),
  policy: OutlierPaymentPolicy = DEFAULT_OUTLIER_POLICY,
): OutlierPayment {
  if (payment.status === "resolved" || payment.status === "cleared") {
    throw new Error(`Cannot add investigation step to payment with status '${payment.status}'`);
  }

  const updatedSteps = Array.from(new Set([...payment.completedSteps, step]));

  const requiredSteps: InvestigationStepType[] = ["initial_review"];
  if (policy.requirePatternAnalysis) requiredSteps.push("pattern_analysis");
  if (policy.requireOperatorVerification) requiredSteps.push("operator_verification");
  requiredSteps.push("resolution_approval");

  const allCompleted = requiredSteps.every((s) => updatedSteps.includes(s));

  return {
    ...payment,
    completedSteps: updatedSteps,
    status: allCompleted ? "cleared" : "under_investigation",
    resolvedAt: allCompleted ? now : undefined,
  };
}

/**
 * Flags an outlier payment as requiring escalated review.
 */
export function flagOutlierPayment(
  payment: OutlierPayment,
  reason: string,
  operatorId: string,
  now = Date.now(),
): OutlierPayment {
  if (!reason || reason.trim().length === 0) {
    throw new Error("Flag reason must be provided");
  }

  return {
    ...payment,
    status: "flagged",
    investigationNotes: reason,
    resolvedAt: now,
    resolutionReason: "escalated_for_review",
  };
}

/**
 * Evaluates an outlier payment against investigation requirements.
 */
export function evaluateOutlierPayment(
  payment: OutlierPayment,
  policy: OutlierPaymentPolicy = DEFAULT_OUTLIER_POLICY,
): OutlierPaymentEvaluation {
  const requiredSteps: InvestigationStepType[] = ["initial_review"];
  if (policy.requirePatternAnalysis) requiredSteps.push("pattern_analysis");
  if (policy.requireOperatorVerification) requiredSteps.push("operator_verification");
  requiredSteps.push("resolution_approval");

  const missingSteps = requiredSteps.filter((s) => !payment.completedSteps.includes(s));
  const allCompleted = missingSteps.length === 0;

  let message = "";
  switch (payment.status) {
    case "detected":
      message = "Outlier payment detected. Investigation required.";
      break;
    case "under_investigation":
      message = `Investigation in progress. ${missingSteps.length} step(s) remaining.`;
      break;
    case "cleared":
      message = "Outlier payment investigation cleared.";
      break;
    case "flagged":
      message = "Outlier payment flagged for escalated review.";
      break;
    case "resolved":
      message = "Outlier payment investigation resolved.";
      break;
  }

  return {
    isOutlier: payment.deviationPercent > policy.deviationThresholdPercent,
    status: payment.status,
    message,
    missingSteps,
    requiresApproval: !allCompleted && payment.status !== "flagged",
  };
}

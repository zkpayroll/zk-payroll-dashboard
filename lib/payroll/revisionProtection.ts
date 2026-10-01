import type { PayrollRun } from "@/types/models";

export type RevisionAction = "edit_employees" | "edit_amounts" | "edit_period" | "unknown";

export interface RevisionProtectionResult {
  canRevise: boolean;
  reason?: string;
  remediation?: string;
}

/**
 * Validates if a payroll run can be revised by an operator.
 * Approved payrolls are locked to maintain audit integrity and require cancellation instead.
 */
export function evaluateRevisionProtection(
  payroll: Pick<PayrollRun, "approvalStatus" | "status"> | null,
  action: RevisionAction = "unknown"
): RevisionProtectionResult {
  if (!payroll) {
    return {
      canRevise: false,
      reason: "Payroll draft not found.",
      remediation: "Refresh the dashboard or select a valid draft.",
    };
  }

  if (payroll.approvalStatus === "approved") {
    return {
      canRevise: false,
      reason: "This payroll has already been approved and cannot be revised.",
      remediation: "To make changes, cancel this payroll and create a new run.",
    };
  }

  if (payroll.status === "cancelled") {
    return {
      canRevise: false,
      reason: "This payroll was cancelled and cannot be revised.",
      remediation: "Start a new payroll run for any future payments.",
    };
  }

  return { canRevise: true };
}

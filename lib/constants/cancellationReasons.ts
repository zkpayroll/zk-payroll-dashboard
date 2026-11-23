export type CancellationReasonCode =
  | "CALCULATION_ERROR"
  | "UNAUTHORIZED_ENTRY"
  | "TREASURY_SHORTFALL"
  | "COMPLIANCE_HOLD"
  | "DUPLICATE_BATCH"
  | "SYSTEM_MAINTENANCE"
  | "OTHER";

export interface CancellationReasonOption {
  code: CancellationReasonCode;
  label: string;
  helperText: string;
  category: "calculation" | "security" | "treasury" | "compliance" | "operational" | "other";
}

export const SUPPORTED_CANCELLATION_REASONS: readonly CancellationReasonOption[] = [
  {
    code: "CALCULATION_ERROR",
    label: "Calculation Error",
    helperText: "Incorrect salary, bonus, or deduction calculations detected in batch.",
    category: "calculation",
  },
  {
    code: "UNAUTHORIZED_ENTRY",
    label: "Unauthorized Entry",
    helperText: "Unverified employee, suspicious address, or unapproved recipient added.",
    category: "security",
  },
  {
    code: "TREASURY_SHORTFALL",
    label: "Treasury Shortfall",
    helperText: "Insufficient liquid treasury reserves available to cover full disbursement.",
    category: "treasury",
  },
  {
    code: "COMPLIANCE_HOLD",
    label: "Compliance Hold",
    helperText: "Regulatory, legal, or auditor review required before executing.",
    category: "compliance",
  },
  {
    code: "DUPLICATE_BATCH",
    label: "Duplicate Batch",
    helperText: "Duplicate payroll run or redundant cycle already in progress.",
    category: "operational",
  },
  {
    code: "SYSTEM_MAINTENANCE",
    label: "System Maintenance",
    helperText: "Smart contract upgrade, network congestion, or planned maintenance.",
    category: "operational",
  },
  {
    code: "OTHER",
    label: "Other Reason",
    helperText: "Custom operational reason (please specify additional details).",
    category: "other",
  },
] as const;

export function getCancellationReason(code: string): CancellationReasonOption | undefined {
  return SUPPORTED_CANCELLATION_REASONS.find((r) => r.code === code);
}

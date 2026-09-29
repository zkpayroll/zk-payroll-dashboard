/**
 * Compliance hold reason codes.
 *
 * These structured codes are attached to compliance hold actions so that
 * every hold is self-describing and auditable without exposing raw payroll values.
 *
 * Privacy note: reason codes reference compliance / regulatory categories only.
 * They MUST NOT include salary amounts, employee identifiers, or other private
 * payroll data.
 */

export type HoldReasonCode =
  | "REGULATORY_REVIEW"
  | "LEGAL_HOLD"
  | "AUDIT_IN_PROGRESS"
  | "SANCTIONS_SCREENING"
  | "FRAUD_INVESTIGATION"
  | "POLICY_VIOLATION"
  | "PENDING_DOCUMENTATION"
  | "OTHER";

export interface HoldReasonOption {
  code: HoldReasonCode;
  label: string;
  helperText: string;
  category: "regulatory" | "legal" | "audit" | "security" | "policy" | "operational" | "other";
}

export const SUPPORTED_HOLD_REASONS: readonly HoldReasonOption[] = [
  {
    code: "REGULATORY_REVIEW",
    label: "Regulatory Review",
    helperText: "A regulatory body has requested a review before disbursement can proceed.",
    category: "regulatory",
  },
  {
    code: "LEGAL_HOLD",
    label: "Legal Hold",
    helperText: "Legal counsel has placed a hold pending resolution of a dispute or court order.",
    category: "legal",
  },
  {
    code: "AUDIT_IN_PROGRESS",
    label: "Audit In Progress",
    helperText: "An internal or external audit is underway; disbursement is paused until complete.",
    category: "audit",
  },
  {
    code: "SANCTIONS_SCREENING",
    label: "Sanctions Screening",
    helperText: "One or more recipients require additional sanctions or AML screening.",
    category: "security",
  },
  {
    code: "FRAUD_INVESTIGATION",
    label: "Fraud Investigation",
    helperText: "Suspicious activity has been flagged; disbursement is frozen pending investigation.",
    category: "security",
  },
  {
    code: "POLICY_VIOLATION",
    label: "Policy Violation",
    helperText: "A payroll policy rule was breached; hold placed until the violation is remediated.",
    category: "policy",
  },
  {
    code: "PENDING_DOCUMENTATION",
    label: "Pending Documentation",
    helperText: "Required supporting documents have not yet been submitted or verified.",
    category: "operational",
  },
  {
    code: "OTHER",
    label: "Other Reason",
    helperText: "Custom compliance reason — provide additional context in the notes field.",
    category: "other",
  },
] as const;

export function getHoldReason(code: string): HoldReasonOption | undefined {
  return SUPPORTED_HOLD_REASONS.find((r) => r.code === code);
}

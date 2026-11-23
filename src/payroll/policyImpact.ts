import type { PayrollPolicy } from "@/types/policy";

export type PolicyImpactSection = keyof Pick<
  PayrollPolicy,
  "timing" | "reserves" | "approvals" | "capacity" | "auditRetention"
>;

export interface PayrollPolicyImpact {
  changedSections: PolicyImpactSection[];
  requiresReview: boolean;
  summary: string;
}

/** Compares policy sections without exposing salary values or employee data. */
export function analyzePayrollPolicyImpact(
  current: PayrollPolicy,
  proposed: PayrollPolicy,
): PayrollPolicyImpact {
  const sections: PolicyImpactSection[] = [
    "timing",
    "reserves",
    "approvals",
    "capacity",
    "auditRetention",
  ];
  const changedSections = sections.filter(
    (section) => JSON.stringify(current[section]) !== JSON.stringify(proposed[section]),
  );

  return {
    changedSections,
    requiresReview: changedSections.length > 0,
    summary: changedSections.length === 0
      ? "No payroll policy changes detected."
      : `Payroll policy changes detected in: ${changedSections.join(", ")}.`,
  };
}
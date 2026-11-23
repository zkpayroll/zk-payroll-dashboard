/**
 * Inactive Company Payroll Run Warning (#762).
 *
 * Detects when a payroll run references an inactive company in the dashboard
 * layer, surfaces an actionable warning banner, and blocks payout execution
 * until the referenced company is reactivated or switched.
 *
 * Privacy Guarantees:
 * - Zero employee PII, salary figures, or compensation amounts are exposed.
 * - Zero cryptographic keys, signatures, or proof secrets are leaked.
 * - Only non-sensitive company identifiers, sanitized names, and remediation
 *   links are returned.
 */

import { MOCK_COMPANIES } from "@/lib/api/mockData";
import type { Company, PayrollRun, PayrollTransaction } from "@/types/models";

export type InactiveCompanyWarningCode =
  | "COMPANY_INACTIVE"
  | "COMPANY_NOT_FOUND"
  | "COMPANY_ID_MISSING";

export type InactiveCompanySeverity = "warning" | "critical";

export interface InactiveCompanyWarningEvaluation {
  /** True when the referenced company is inactive, missing, or unresolved */
  hasWarning: boolean;
  /** True when execution or disbursement should be blocked */
  blocking: boolean;
  /** Standard warning/error code */
  code: InactiveCompanyWarningCode | null;
  /** Severity level for UI display */
  severity: InactiveCompanySeverity | null;
  /** Sanitized company identifier */
  companyId: string | null;
  /** Safe display name of the company (when resolved) */
  companyName: string | null;
  /** Title of the warning for user-facing UI */
  title: string | null;
  /** Actionable, privacy-safe explanation (zero salary or employee data) */
  message: string | null;
  /** Primary remediation button label */
  actionLabel: string | null;
  /** Primary remediation target link */
  actionHref: string | null;
  /** Ordered list of actionable remediation steps */
  nextSteps: string[];
}

export type CompanyRegistryInput =
  | Company[]
  | Record<string, Company>
  | Map<string, Company>
  | null
  | undefined;

/**
 * Resolves a company entity by companyId from an optional registry or mock data.
 */
export function resolveCompanyFromRegistry(
  companyId: string,
  registry?: CompanyRegistryInput,
): Company | null {
  if (!companyId) return null;

  if (registry instanceof Map) {
    return registry.get(companyId) ?? null;
  }

  if (Array.isArray(registry)) {
    return registry.find((c) => c && c.id === companyId) ?? null;
  }

  if (registry && typeof registry === "object") {
    return (registry as Record<string, Company>)[companyId] ?? null;
  }

  return MOCK_COMPANIES.find((c) => c.id === companyId) ?? null;
}

/**
 * Evaluates whether a payroll run references an inactive or invalid company.
 *
 * @param run Partial or full payroll run / transaction object.
 * @param registry Optional company collection or lookup map.
 * @returns Privacy-safe evaluation result with actionable remediation.
 */
export function evaluatePayrollRunCompany(
  run?: Partial<PayrollRun | PayrollTransaction> | null,
  registry?: CompanyRegistryInput,
): InactiveCompanyWarningEvaluation {
  // Boundary Case: null, undefined, or empty run
  if (!run) {
    return {
      hasWarning: true,
      blocking: true,
      code: "COMPANY_ID_MISSING",
      severity: "critical",
      companyId: null,
      companyName: null,
      title: "No payroll run provided",
      message:
        "Cannot verify company status without a valid payroll run reference.",
      actionLabel: "Return to payroll",
      actionHref: "/payroll",
      nextSteps: [
        "Select a valid payroll run from the dashboard.",
        "Ensure the run identifier is correct.",
      ],
    };
  }

  const rawCompanyId = run.companyId ? String(run.companyId).trim() : "";

  // Boundary Case: missing or blank companyId on the run
  if (!rawCompanyId) {
    return {
      hasWarning: true,
      blocking: true,
      code: "COMPANY_ID_MISSING",
      severity: "critical",
      companyId: null,
      companyName: null,
      title: "Missing company reference",
      message:
        "This payroll run does not reference a valid company entity. Payout execution and disbursements are blocked.",
      actionLabel: "Return to payroll",
      actionHref: "/payroll",
      nextSteps: [
        "Verify that the payroll batch was created under an active company.",
        "Check batch metadata or re-import the payroll under a configured company profile.",
        "Contact your administrator if this run was generated externally.",
      ],
    };
  }

  // Look up company
  const company = resolveCompanyFromRegistry(rawCompanyId, registry);

  // Boundary Case: company not found in registry
  if (!company) {
    const sanitizedId =
      rawCompanyId.length > 40
        ? `${rawCompanyId.slice(0, 37)}...`
        : rawCompanyId;

    return {
      hasWarning: true,
      blocking: true,
      code: "COMPANY_NOT_FOUND",
      severity: "critical",
      companyId: sanitizedId,
      companyName: null,
      title: "Referenced company not found",
      message: `The company referenced by this payroll run (${sanitizedId}) could not be found in the organization directory.`,
      actionLabel: "Switch company context",
      actionHref: "/company/switch",
      nextSteps: [
        "Verify that the organization profile exists in company settings.",
        "Switch to an active company context before managing or executing payroll.",
        "Re-link this payroll run to a registered company profile.",
      ],
    };
  }

  // Warning Case: referenced company is inactive
  if (!company.isActive) {
    const displayName = company.name || company.id;
    return {
      hasWarning: true,
      blocking: true,
      code: "COMPANY_INACTIVE",
      severity: "critical",
      companyId: company.id,
      companyName: displayName,
      title: "Payroll run references an inactive company",
      message: `This payroll run references ${displayName}, which is currently inactive. Payout execution and disbursements are disabled until the company is reactivated.`,
      actionLabel: "Switch company context",
      actionHref: "/company/switch",
      nextSteps: [
        `Reactivate ${displayName} in Company Settings before processing disbursements.`,
        "Switch your active company context to continue processing other payroll runs.",
        "Verify administrative signing authority and smart contract configuration.",
      ],
    };
  }

  // Success Case: referenced company is active
  return {
    hasWarning: false,
    blocking: false,
    code: null,
    severity: null,
    companyId: company.id,
    companyName: company.name,
    title: null,
    message: null,
    actionLabel: null,
    actionHref: null,
    nextSteps: [],
  };
}

/**
 * Convenience helper to determine if a run references an active company.
 */
export function isPayrollRunCompanyActive(
  run?: Partial<PayrollRun | PayrollTransaction> | null,
  registry?: CompanyRegistryInput,
): boolean {
  return !evaluatePayrollRunCompany(run, registry).hasWarning;
}

/**
 * Strips all local state and returns an audit-safe serialization
 * guaranteed never to contain sensitive employee or financial figures.
 */
export function sanitizeCompanyWarningForAudit(
  evaluation: InactiveCompanyWarningEvaluation,
): {
  code: InactiveCompanyWarningCode | null;
  companyId: string | null;
  hasWarning: boolean;
  blocking: boolean;
  severity: InactiveCompanySeverity | null;
} {
  return {
    code: evaluation.code,
    companyId: evaluation.companyId,
    hasWarning: evaluation.hasWarning,
    blocking: evaluation.blocking,
    severity: evaluation.severity,
  };
}

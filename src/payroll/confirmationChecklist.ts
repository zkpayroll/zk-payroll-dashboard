/**
 * Payroll confirmation audit checklist (#268).
 *
 * Reviewers must walk a fixed set of pre-submission checks (treasury,
 * employee data, approvals, network readiness) before a payroll run can be
 * confirmed. Checklist state is privacy-safe: it tracks verification status
 * only and never carries salary values or payment amounts.
 */

export type ConfirmationCheckCategory =
  | "treasury"
  | "employee_data"
  | "approval"
  | "network";

export interface PayrollConfirmationCheck {
  id: string;
  category: ConfirmationCheckCategory;
  label: string;
  isRequired: boolean;
  isVerified: boolean;
}

export interface ConfirmationChecklistEvaluation {
  canConfirm: boolean;
  requiredCount: number;
  verifiedRequiredCount: number;
  optionalCount: number;
  progressPercent: number;
  /** Required checks that are still unverified — the gate on confirmation. */
  unmetItems: PayrollConfirmationCheck[];
  statusMessage: string;
}

export const CONFIRMATION_CATEGORY_LABELS: Record<
  ConfirmationCheckCategory,
  string
> = {
  treasury: "Treasury Readiness",
  employee_data: "Employee Data",
  approval: "Approvals",
  network: "Network Readiness",
};

const REQUIRED_LABELS: Array<{
  id: string;
  category: ConfirmationCheckCategory;
  label: string;
}> = [
  {
    id: "treasury_funding_verified",
    category: "treasury",
    label: "Treasury balance covers the full run total and fee buffer.",
  },
  {
    id: "treasury_reservations_confirmed",
    category: "treasury",
    label: "Funding reservations are locked for this run.",
  },
  {
    id: "employee_roster_validated",
    category: "employee_data",
    label: "Employee roster is validated and ineligible employees are resolved.",
  },
  {
    id: "employee_commitments_current",
    category: "employee_data",
    label: "Salary commitments are current (no stale commitment versions).",
  },
  {
    id: "approval_thresholds_met",
    category: "approval",
    label: "Required approval thresholds are met for this run.",
  },
  {
    id: "approval_signers_confirmed",
    category: "approval",
    label: "Designated signers have confirmed participation.",
  },
  {
    id: "network_congestion_checked",
    category: "network",
    label: "Network conditions checked — fees and submission window are acceptable.",
  },
];

const OPTIONAL_LABELS: Array<{
  id: string;
  category: ConfirmationCheckCategory;
  label: string;
}> = [
  {
    id: "audit_trail_exported",
    category: "approval",
    label: "Pre-confirmation audit trail snapshot exported for reviewers.",
  },
];

export function createDefaultConfirmationChecklist(
  overrides: Partial<Record<string, boolean>> = {},
): PayrollConfirmationCheck[] {
  const required = REQUIRED_LABELS.map((item) => ({
    ...item,
    isRequired: true,
    isVerified: overrides[item.id] ?? false,
  }));
  const optional = OPTIONAL_LABELS.map((item) => ({
    ...item,
    isRequired: false,
    isVerified: overrides[item.id] ?? false,
  }));
  return [...required, ...optional];
}

export function toggleConfirmationCheck(
  items: PayrollConfirmationCheck[],
  checkId: string,
): PayrollConfirmationCheck[] {
  return items.map((item) =>
    item.id === checkId ? { ...item, isVerified: !item.isVerified } : item,
  );
}

export function evaluateConfirmationReadiness(
  items: PayrollConfirmationCheck[],
): ConfirmationChecklistEvaluation {
  const requiredItems = items.filter((i) => i.isRequired);
  const optionalItems = items.filter((i) => !i.isRequired);
  const unmetItems = requiredItems.filter((i) => !i.isVerified);
  const verifiedRequiredCount = requiredItems.length - unmetItems.length;
  // Progress measures the path to confirmability: the required checks. An
  // optional check can be verified at any time and never moves this needle,
  // so a reviewer sees 100% exactly when confirmation is unblocked.
  const progressPercent =
    requiredItems.length === 0
      ? 100
      : Math.round((verifiedRequiredCount / requiredItems.length) * 100);
  const canConfirm = requiredItems.length > 0 && unmetItems.length === 0;

  let statusMessage: string;
  if (requiredItems.length === 0) {
    statusMessage =
      "No required confirmation checks defined — add required checks before confirming a run.";
  } else if (canConfirm) {
    statusMessage = `All ${requiredItems.length} required checks verified. The payroll run can be confirmed.`;
  } else {
    statusMessage = `${unmetItems.length} of ${requiredItems.length} required checks still need verification before confirmation.`;
  }

  return {
    canConfirm,
    requiredCount: requiredItems.length,
    verifiedRequiredCount,
    optionalCount: optionalItems.length,
    progressPercent,
    unmetItems,
    statusMessage,
  };
}

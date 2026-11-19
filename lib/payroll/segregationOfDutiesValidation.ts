/**
 * Dashboard segregation of duties validation.
 *
 * Enforces segregation of duties in payroll operations by ensuring
 * the same operator cannot both create and approve the same batch.
 * Privacy-safe: validates roles and permissions without exposing salary data.
 */

export type PayrollOperatorRole =
  | "admin"
  | "operator"
  | "approver"
  | "viewer"
  | "guest";

export interface PayrollOperator {
  id: string;
  name: string;
  role: PayrollOperatorRole;
  email?: string;
}

export interface PayrollBatch {
  id: string;
  createdBy: string;
  createdAt: string;
  status: "draft" | "submitted" | "approved" | "executed" | "rejected";
  approvals: PayrollApproval[];
}

export interface PayrollApproval {
  operatorId: string;
  approvedAt: string;
  status: "approved" | "rejected";
}

export interface SegregationOfDutiesValidation {
  isValid: boolean;
  violations: SegregationViolation[];
  message: string;
  canApprove: boolean;
}

export interface SegregationViolation {
  type: "creator_cannot_approve" | "insufficient_approvers" | "unknown";
  severity: "critical" | "warning";
  description: string;
  affectedOperator?: string;
  remediation: string;
}

const ROLE_HIERARCHY: Record<PayrollOperatorRole, number> = {
  guest: 0,
  viewer: 1,
  operator: 2,
  approver: 3,
  admin: 4,
};

export function getOperatorRankings(
  role: PayrollOperatorRole,
): PayrollOperatorRole[] {
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, rank]) => rank <= ROLE_HIERARCHY[role])
    .map(([r]) => r as PayrollOperatorRole);
}

export function canOperatorCreateBatch(operator: PayrollOperator): boolean {
  return (
    operator.role === "admin" ||
    operator.role === "operator"
  );
}

export function canOperatorApproveBatch(operator: PayrollOperator): boolean {
  return (
    operator.role === "admin" ||
    operator.role === "approver"
  );
}

export function validateSegregationOfDuties(
  batch: PayrollBatch,
  currentOperator: PayrollOperator,
  existingApprovers: PayrollOperator[] = [],
): SegregationOfDutiesValidation {
  const violations: SegregationViolation[] = [];

  if (!canOperatorCreateBatch(currentOperator)) {
    violations.push({
      type: "unknown",
      severity: "critical",
      description: `Operator "${currentOperator.name}" with role "${currentOperator.role}" cannot create payroll batches.`,
      affectedOperator: currentOperator.id,
      remediation:
        "Contact an administrator to grant the operator or approver role.",
    });
  }

  if (!canOperatorApproveBatch(currentOperator)) {
    const isCreator = batch.createdBy === currentOperator.id;
    if (isCreator) {
      violations.push({
        type: "creator_cannot_approve",
        severity: "critical",
        description:
          "Segregation of duties violation: the creator of a batch cannot approve their own batch.",
        affectedOperator: currentOperator.id,
        remediation:
          "Request approval from an operator with the approver or admin role.",
      });
    }
  }

  if (batch.createdBy === currentOperator.id && canOperatorApproveBatch(currentOperator)) {
    violations.push({
      type: "creator_cannot_approve",
      severity: "critical",
      description:
        "Segregation of duties policy prevents the batch creator from approving their own batch.",
      affectedOperator: currentOperator.id,
      remediation:
        "Request approval from a different operator with approval authority.",
    });
  }

  const hasApprovals = batch.approvals && batch.approvals.length > 0;
  const approverCount = hasApprovals
    ? new Set(batch.approvals.map((a) => a.operatorId)).size
    : 0;

  if (hasApprovals && approverCount < 1 && batch.status === "submitted") {
    violations.push({
      type: "insufficient_approvers",
      severity: "warning",
      description: "The batch has not yet received any approvals.",
      remediation:
        "Route the batch to an operator with approval authority for review.",
    });
  }

  const isValid = violations.length === 0;
  const canApprove =
    canOperatorApproveBatch(currentOperator) &&
    batch.createdBy !== currentOperator.id;

  return {
    isValid,
    violations,
    message: isValid
      ? "Segregation of duties requirements are satisfied."
      : `Found ${violations.length} segregation of duties issue(s).`,
    canApprove,
  };
}

export function checkCreatorApprovalViolation(
  batch: PayrollBatch,
  operator: PayrollOperator,
): boolean {
  return (
    batch.createdBy === operator.id && canOperatorApproveBatch(operator)
  );
}

export function getOperatorApprovalEligibility(
  batch: PayrollBatch,
  operator: PayrollOperator,
): {
  eligible: boolean;
  reason: string;
} {
  if (!canOperatorApproveBatch(operator)) {
    return {
      eligible: false,
      reason: `Operator role "${operator.role}" does not have approval authority.`,
    };
  }

  if (batch.createdBy === operator.id) {
    return {
      eligible: false,
      reason:
        "Segregation of duties policy prevents the batch creator from approving their own batch.",
    };
  }

  if (batch.status !== "submitted") {
    return {
      eligible: false,
      reason: `Batch status "${batch.status}" does not allow approvals.`,
    };
  }

  return {
    eligible: true,
    reason: "Operator is eligible to approve this batch.",
  };
}

export const SEGREGATION_POLICY_GUIDELINES = {
  summary:
    "Segregation of duties policy ensures payroll integrity by preventing a single operator from creating and approving the same batch.",
  principles: [
    "Creator and approver must be different operators.",
    "Admin role may override segregation requirements only with audit trail.",
    "All approval actions are recorded with operator identity and timestamp.",
    "Policy applies to all payroll batch types with no exceptions.",
  ],
  bestPractices: [
    "Assign creator and approver roles to different team members.",
    "Rotate approval responsibilities regularly.",
    "Review approval logs monthly for compliance.",
    "Document any policy exceptions with management approval.",
  ],
};

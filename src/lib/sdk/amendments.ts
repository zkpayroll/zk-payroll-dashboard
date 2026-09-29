/**
 * Encrypted salary commitment amendment SDK (#424 — Amendments workflow).
 *
 * Maintainers review amendments that update an employee's salary commitment
 * without ever seeing the raw salary value. This module models the
 * privacy-safe amendment metadata the UI is allowed to display and the
 * validation logic that decides whether an amendment plan can be approved.
 *
 * Privacy rule: only commitment hashes/versions, anonymized employee
 * references, payroll period, asset code, and approval status are surfaced.
 * Raw salary amounts, memos, or secrets are never included.
 */

export type AmendmentStatus = "pending" | "approved" | "blocked" | "failed" | "rejected";

export type AmendmentAsset = {
  code: string;
  issuer?: string;
};

export interface SalaryCommitmentAmendment {
  id: string;
  employeeId: string;
  /** Privacy-safe employee identifier shown to maintainers (e.g. Employee #12) */
  employeeReference: string;
  /** Commitment version that will be active after approval */
  commitmentVersion: number;
  /** Commitment version that is currently on-chain */
  previousVersion: number;
  /** Hash of the currently active commitment (safe to display, truncated) */
  previousCommitment: string;
  /** Hash of the proposed commitment (encrypted salary — hash only) */
  nextCommitment: string;
  /** Payroll period this amendment applies to (e.g. 2025-03) */
  period: string;
  asset: AmendmentAsset;
  approvalStatus: AmendmentStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  /** Operator-provided rationale — privacy-safe copy, no salary values */
  reason?: string;
  /**
   * SDK-reported freshness. True when a newer commitment version already
   * exists on-chain, making this amendment stale.
   */
  isStale?: boolean;
  staleReason?: string;
  /**
   * SDK-reported policy compliance. False when the amendment violates the
   * current commitment policy (e.g. threshold, asset allow-list, period lock).
   */
  isPolicyValid?: boolean;
  policyInvalidReason?: string;
}

export interface AmendmentPlanValidation {
  canApprove: boolean;
  isStale: boolean;
  isPolicyValid: boolean;
  isBlocked: boolean;
  /** Human-readable reason approval is blocked, if applicable */
  blockedReason?: string;
  /** Privacy-safe next steps for the operator */
  nextSteps?: string;
}

export interface AmendmentDiffField {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface AmendmentSafeDiff {
  fields: AmendmentDiffField[];
  hasChanges: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateAmendmentPlan(
  amendment: SalaryCommitmentAmendment,
): AmendmentPlanValidation {
  const isStale = amendment.isStale ?? false;
  const isPolicyValid = amendment.isPolicyValid ?? true;
  const isPolicyInvalid = !isPolicyValid;
  const isBlockedStatus =
    amendment.approvalStatus === "blocked" ||
    amendment.approvalStatus === "failed" ||
    amendment.approvalStatus === "rejected";
  const isBlocked = isStale || isPolicyInvalid || isBlockedStatus;

  let blockedReason: string | undefined;
  let nextSteps: string | undefined;

  if (isStale) {
    blockedReason =
      amendment.staleReason ??
      "This amendment is stale — a newer commitment version exists on-chain.";
    nextSteps =
      "Request a fresh amendment with the latest commitment version before approving.";
  } else if (isPolicyInvalid) {
    blockedReason =
      amendment.policyInvalidReason ??
      "This amendment violates the current approval policy.";
    nextSteps =
      "Update the amendment to meet policy requirements or rotate the approval policy before retrying.";
  } else if (amendment.approvalStatus === "blocked") {
    blockedReason = "This amendment is blocked and requires re-approval.";
    nextSteps = "Resolve blockers and resubmit the amendment for approval.";
  } else if (amendment.approvalStatus === "failed") {
    blockedReason = "This amendment failed verification.";
    nextSteps = "Regenerate the encrypted commitment and resubmit. Salary values remain private.";
  } else if (amendment.approvalStatus === "rejected") {
    blockedReason = "This amendment was rejected.";
    nextSteps = "Address reviewer feedback and create a new amendment if needed.";
  } else if (amendment.approvalStatus === "approved") {
    nextSteps = "Amendment already approved — no further action required. New commitment is active.";
  } else if (amendment.approvalStatus === "pending") {
    nextSteps = "Review safe metadata below and approve to apply the new commitment. Salary values stay encrypted.";
  }

  const canApprove =
    !isBlocked && amendment.approvalStatus === "pending" && !isStale && isPolicyValid;

  return {
    canApprove,
    isStale,
    isPolicyValid,
    isBlocked,
    blockedReason,
    nextSteps,
  };
}

// ─── Safe diff ──────────────────────────────────────────────────────────────

export function formatAsset(asset: AmendmentAsset): string {
  if (asset.issuer) return `${asset.code}:${asset.issuer.slice(0, 6)}…`;
  return asset.code;
}

export function getAmendmentSafeDiff(
  amendment: SalaryCommitmentAmendment,
): AmendmentSafeDiff {
  const fields: AmendmentDiffField[] = [
    {
      label: "Commitment version",
      before: `v${amendment.previousVersion}`,
      after: `v${amendment.commitmentVersion}`,
      changed: amendment.previousVersion !== amendment.commitmentVersion,
    },
    {
      label: "Employee reference",
      before: amendment.employeeReference,
      after: amendment.employeeReference,
      changed: false,
    },
    {
      label: "Period",
      before: amendment.period,
      after: amendment.period,
      changed: false,
    },
    {
      label: "Asset",
      before: formatAsset(amendment.asset),
      after: formatAsset(amendment.asset),
      changed: false,
    },
    {
      label: "Approval status",
      before: amendment.approvalStatus,
      after: amendment.approvalStatus,
      changed: true,
    },
    {
      label: "Commitment hash",
      before: amendment.previousCommitment,
      after: amendment.nextCommitment,
      changed: amendment.previousCommitment !== amendment.nextCommitment,
    },
  ];

  return {
    fields,
    hasChanges: fields.some((f) => f.changed),
  };
}

// ─── Mock fixtures covering QA states ───────────────────────────────────────

export const MOCK_AMENDMENTS: SalaryCommitmentAmendment[] = [
  {
    id: "amd_valid_001",
    employeeId: "emp_001",
    employeeReference: "Employee #1",
    commitmentVersion: 3,
    previousVersion: 2,
    previousCommitment: "0xabc123def456_commitment_v2_hash_safe_to_show",
    nextCommitment: "0xdef789ghi012_commitment_v3_hash_encrypted_salary",
    period: "2025-03",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    approvalStatus: "pending",
    createdAt: "2025-03-10T08:00:00Z",
    updatedAt: "2025-03-10T08:00:00Z",
    requestedBy: "Payroll Operator",
    reason: "Scheduled compensation review — new commitment generated.",
    isStale: false,
    isPolicyValid: true,
  },
  {
    id: "amd_stale_001",
    employeeId: "emp_002",
    employeeReference: "Employee #2",
    commitmentVersion: 2,
    previousVersion: 1,
    previousCommitment: "0x111_commitment_v1_old",
    nextCommitment: "0x222_commitment_v2_stale_hash",
    period: "2025-03",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    approvalStatus: "pending",
    createdAt: "2025-03-08T09:00:00Z",
    updatedAt: "2025-03-12T10:00:00Z",
    requestedBy: "Payroll Operator",
    reason: "Late amendment based on outdated version.",
    isStale: true,
    staleReason: "Commitment v3 already exists on-chain. This plan is stale.",
    isPolicyValid: true,
  },
  {
    id: "amd_blocked_001",
    employeeId: "emp_004",
    employeeReference: "Employee #4",
    commitmentVersion: 4,
    previousVersion: 3,
    previousCommitment: "0x333_commitment_v3_blocked_prev",
    nextCommitment: "0x444_commitment_v4_policy_invalid_hash",
    period: "2025-04",
    asset: { code: "EURC", issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP" },
    approvalStatus: "blocked",
    createdAt: "2025-03-15T11:00:00Z",
    updatedAt: "2025-03-16T12:00:00Z",
    requestedBy: "Payroll Operator",
    reason: "Asset change requires policy review.",
    isStale: false,
    isPolicyValid: false,
    policyInvalidReason: "EURC is not allow-listed under the current asset policy.",
  },
  {
    id: "amd_failed_001",
    employeeId: "emp_003",
    employeeReference: "Employee #3",
    commitmentVersion: 2,
    previousVersion: 1,
    previousCommitment: "0x555_commitment_v1_failed_prev",
    nextCommitment: "0x666_commitment_v2_failed_hash",
    period: "2025-02",
    asset: { code: "XLM" },
    approvalStatus: "failed",
    createdAt: "2025-02-20T07:00:00Z",
    updatedAt: "2025-02-21T08:00:00Z",
    requestedBy: "System",
    reason: "Commitment proof generation failed.",
    isStale: false,
    isPolicyValid: true,
  },
  {
    id: "amd_approved_001",
    employeeId: "emp_005",
    employeeReference: "Employee #5",
    commitmentVersion: 2,
    previousVersion: 1,
    previousCommitment: "0x777_commitment_v1_approved_prev",
    nextCommitment: "0x888_commitment_v2_approved_hash",
    period: "2025-02",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    approvalStatus: "approved",
    createdAt: "2025-02-05T09:00:00Z",
    updatedAt: "2025-02-06T10:00:00Z",
    requestedBy: "Payroll Operator",
    reason: "Initial encrypted compensation commitment.",
    isStale: false,
    isPolicyValid: true,
  },
  {
    id: "amd_policy_invalid_001",
    employeeId: "emp_001",
    employeeReference: "Employee #1",
    commitmentVersion: 5,
    previousVersion: 4,
    previousCommitment: "0x999_commitment_v4_prev_policy",
    nextCommitment: "0xaaa_commitment_v5_policy_invalid",
    period: "2025-04",
    asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    approvalStatus: "pending",
    createdAt: "2025-04-01T08:00:00Z",
    updatedAt: "2025-04-01T08:00:00Z",
    requestedBy: "Payroll Operator",
    reason: "Mid-cycle adjustment outside policy window.",
    isStale: false,
    isPolicyValid: false,
    policyInvalidReason: "Amendment window closed for period 2025-04. Policy allows changes only before period start.",
  },
];

// ─── Async SDK-style fetchers (mock) ────────────────────────────────────────

export async function fetchAmendments(): Promise<SalaryCommitmentAmendment[]> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return MOCK_AMENDMENTS;
}

export async function fetchAmendmentById(
  id: string,
): Promise<SalaryCommitmentAmendment | null> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return MOCK_AMENDMENTS.find((a) => a.id === id) ?? null;
}

export async function validateAmendmentPlanAsync(
  id: string,
): Promise<AmendmentPlanValidation | null> {
  const amendment = await fetchAmendmentById(id);
  if (!amendment) return null;
  return validateAmendmentPlan(amendment);
}

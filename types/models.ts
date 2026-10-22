import type { StellarNetwork } from "./stellar";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

// ─── Employee Lifecycle Management (#454) ────────────────────────────────────

export type EmployeeLifecycleStatus =
  | "active"
  | "suspended"
  | "offboarded"
  | "archived";

export interface EmployeeLifecycleEvent {
  id: string;
  employeeId: string;
  action: "activate" | "suspend" | "offboard" | "archive" | "restore";
  performedBy: string;
  performedAt: string;
  note?: string;
}

export interface Employee {
  id: string;
  address: string;
  name: string;
  email?: string;
  department?: string;
  salary: number;
  salaryCommitment: string;
  isActive: boolean;
  status?: "active" | "inactive" | "pending";
  onboardingStatus: OnboardingStatus;
  onboardingRetryCount?: number;
  onboardingError?: string | null;
  lastOnboardingAttemptAt?: string | null;
  startDate: string;
  lastPayment?: string;
  /** Lifecycle management status — complements `isActive` / `status`. */
  lifecycleStatus?: EmployeeLifecycleStatus;
  suspendedAt?: string | null;
  offboardedAt?: string | null;
  /** Privacy-safe reason for the most recent lifecycle transition. */
  lifecycleNote?: string | null;
}

export interface Company {
  id: string;
  name: string;
  admin: string;
  treasury: string;
  employeeCount: number;
  isActive: boolean;
}

/**
 * Soroban contract IDs backing a company's on-chain payroll deployment.
 * Each value is expected to be a Soroban contract address (starts with `C`,
 * 56 characters).
 */
export interface CompanyContractConfig {
  registry: string;
  commitment: string;
  verifier: string;
  executor: string;
  audit: string;
}

/**
 * A company's full operational configuration: the base {@link Company} profile
 * plus the network selection and on-chain contract wiring required to run
 * payroll. Used by the configuration sanity check.
 */
export interface CompanyConfig extends Company {
  network: StellarNetwork;
  contracts: CompanyContractConfig;
  /**
   * Schema version of the organization policy configuration. Versions below
   * {@link CURRENT_CONFIG_SCHEMA_VERSION} are considered legacy and must be
   * migrated (validated via `validateCompanyConfigMigration`) before they are
   * used for payroll.
   *
   * Optional for backward compatibility: configs without this field are
   * treated as schema version 1 (see {@link DEFAULT_CONFIG_SCHEMA_VERSION}).
   */
  configSchemaVersion?: number;
  /** Optional token (SAC/asset) contract used for disbursements. */
  tokenContractId?: string;
  /** Optional audit/logging settings */
  auditSettings?: {
    enabled: boolean;
    retentionDays?: number;
    requireAuditorApproval?: boolean;
  };
}

/**
 * Schema version assumed for configs persisted before versioning was
 * introduced (config created before `configSchemaVersion` existed).
 */
export const DEFAULT_CONFIG_SCHEMA_VERSION = 1;

/** The newest organization policy schema version the dashboard understands. */
export const CURRENT_CONFIG_SCHEMA_VERSION = 2;

/** Incompatible policy combinations introduced in schema version 2. */
export type ConfigSchemaV2Incompatibility =
  | "audit-settings-on-public-network"
  | "inactive-company";

export const CONFIG_SCHEMA_V2_INCOMPATIBILITIES: Record<
  ConfigSchemaV2Incompatibility,
  string
> = {
  "audit-settings-on-public-network":
    "Audit logging cannot be required on Stellar Mainnet (PUBLIC). Disable auditor approval or switch to TESTNET.",
  "inactive-company":
    "Inactive companies cannot hold a migrated (current) policy. Reactivate the company before migrating.",
};

export type HealthCheckKey =
  | "companySetup"
  | "adminRole"
  | "treasuryAccount"
  | "contractIds"
  | "networkConfig"
  | "auditSettings";

export type HealthCheckStatus = "pass" | "warning" | "fail";

export interface CompanyHealthCheckItem {
  key: HealthCheckKey;
  label: string;
  status: HealthCheckStatus;
  message: string;
  actionUrl?: string;
}

export interface CompanyHealthCheckResult {
  companyId: string;
  overallStatus: "healthy" | "warning" | "failing";
  checks: CompanyHealthCheckItem[];
  timestamp: string;
}

export type UserRole = "admin" | "operator" | "auditor";

export interface SessionPayload {
  publicKey: string;
  role: UserRole;
  expiresAt: number;
}

export type ReconciliationOutcome =
  | "matched"
  | "pending"
  | "mismatched"
  | "failed"
  | "manually_reviewed";

export type ReconciliationStatus = ReconciliationOutcome | "partial" | "complete";

export interface PayrollTransaction {
  id: string;
  companyId: string;
  timestamp: string;
  createdAt: string; // Added for consistency with API filters
  updatedAt?: string | null;
  lastUpdated?: string | null;
  totalAmount: number;
  employeeCount: number;
  proof: string;
  status: "pending" | "verified" | "failed" | "cancelled" | "paused";
  reconciliationStatus?: ReconciliationStatus;
  reconciliationDetails?: {
    processedCount: number;
    totalCount: number;
    discrepancies?: string[];
    lastReconciliedAt?: string;
  };
  approvalStatus?:
    | "draft"
    | "pending_executive_approval"
    | "approved"
    | "rejected"
    | "correction_requested";
  approvalHistory?: Array<{
    approvedBy: string;
    approvedAt: string;
    role: string;
    comment?: string;
    action?: "approved" | "rejected" | "correction_requested" | "resubmitted";
  }>;
  txHash?: string;
  /** Settlement reference used for receipt lookup; absent until confirmed. */
  receiptId?: string | null;
  /** Account sequence reported by the network for this execution, when available. */
  confirmationNonce?: string | null;
  isArchived?: boolean;
  /**
   * Cancellation reason for run-derived history rows (#284). Mirrors
   * `PayrollRun["cancellationReason"]`.
   */
  cancellationReason?:
    | "treasury_insufficient"
    | "approval_rejected"
    | "compliance_hold"
    | "duplicate_batch"
    | "manual_request"
    | "expired_proof"
    | "unknown";
  /** Emergency pause metadata (#665). Mirrors `PayrollRun`'s pause fields. */
  pausedAt?: string | null;
  pausedBy?: string | null;
  pauseReason?: string | null;
  statusBeforePause?: "pending" | "verified";
  /** Payroll policy revision the run executed under (#751); absent on older runs. */
  policyRevision?: number | null;
  /** Set when proof verification failed because of a verification key mismatch (#763). */
  verificationKeyMismatch?: import("@/lib/zk/verificationKeyMismatch").VerificationKeyMismatch;
}

export type PayrollCancellationReason =
  | "treasury_insufficient"
  | "approval_rejected"
  | "compliance_hold"
  | "duplicate_batch"
  | "manual_request"
  | "expired_proof"
  | "unknown";

export interface PayrollRun extends PayrollTransaction {
  employeeIds: string[];
  /** Settlement-service receipt identifier; absent until settlement completes. */
  receiptId?: string | null;
  executedAt?: string | null;
  transactionHash?: string | null;
  reconciliationStatus?: ReconciliationStatus;
  reconciliationDetails?: {
    processedCount: number;
    totalCount: number;
    discrepancies?: string[];
    lastReconciliedAt?: string;
  };
  /** Cancellation details — present only when status is cancelled. */
  cancellationReason?: PayrollCancellationReason;
  cancellationDetail?: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  /**
   * Emergency pause details (#665) — present only when status is "paused".
   * Unlike cancellation, a paused run is resumable: the dispatch pipeline
   * must check `status !== "paused"` before continuing settlement, and
   * resuming clears these fields and restores the prior status.
   */
  pausedAt?: string | null;
  pausedBy?: string | null;
  pauseReason?: string | null;
  /** The status to restore on resume (what the run was before it was paused). */
  statusBeforePause?: "pending" | "verified";
}

export interface ViewKey {
  id: string;
  keyId: string;
  auditorName: string;
  auditorOrg: string;
  scope: "read-only" | "full-audit";
  grantedBy: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  revokedAt?: string | null;
  revokedBy?: string;
  revocationReason?: string;
}

export type {
  AuditGrantDetail,
  AuditGrantScopeItem,
} from "@/components/features/audit/AuditGrantScopeDetailsDrawer";

export interface RevocationHistory {
  id: string;
  viewKeyId: string;
  revokedAt: string;
  revokedBy: string;
  reason: string;
  auditorName: string;
  auditorOrg: string;
}

export interface FundingForecast {
  cycleStart: string;
  cycleEnd: string;
  estimatedTotal: number;
  employeeCount: number;
  breakdown: {
    payrollTotal: number;
    bufferReserve: number;
    miscellaneous: number;
  };
  currentBalance: number;
  fundingGap: number;
  confidence: "high" | "medium" | "low";
  uncertaintyFactors: string[];
}

export type PayrollWizardStep = "review" | "proof" | "confirm" | "submit";

export interface PayrollWizardState {
  currentStep: PayrollWizardStep;
  employeeIds: string[];
  totalAmount: number;
  /**
   * Version of the saved payroll policy snapshotted when this draft started
   * (#534). The badge on the review/confirm steps compares it against the
   * active version so a mid-run policy change is visible. Null when the draft
   * predates version snapshotting or no saved policy existed.
   */
  instructionVersion?: number | null;
  proof: string | null;
  proofStatus: "idle" | "generating" | "success" | "error";
  proofError: string | null;
  submissionStatus: "idle" | "submitting" | "success" | "error";
  submissionError: string | null;
  transactionHash: string | null;
  isProofNearingExpiration?: boolean;
  treasuryBalanceOverride?: number | null;
  /**
   * Set when a proof generation or transaction submission was in flight
   * (proofStatus/submissionStatus was not "idle") and the step reached was
   * past "review" at the moment the draft was last persisted. Survives a
   * browser close / network drop mid-flow so the wizard can distinguish a
   * plain unsubmitted draft from a settlement that was interrupted
   * mid-submission (#755). Never holds proof artifacts or transaction
   * hashes — only the step name for display.
   */
  interruptedAtStep?: PayrollWizardStep | null;
}

export type ApprovalEventType =
  | "draft_created"
  | "draft_edited"
  | "proof_generation_started"
  | "proof_generation_completed"
  | "proof_generation_failed"
  | "payroll_confirmed"
  | "submission_started"
  | "submission_completed"
  | "submission_failed";

export interface ApprovalEvent {
  id: string;
  type: ApprovalEventType;
  timestamp: string;
  actor: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface AuditAccessRequest {
  id: string;
  requesterName: string;
  requesterOrg: string;
  requesterEmail: string;
  scope: "read-only" | "full-audit";
  rationale: string;
  reviewerNotes?: string;
  requestedExpiresAt?: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "expired"
    | "revoked"
    | "export_ready";
  createdAt: string;
  updatedAt?: string;
  viewKeyId?: string;
}

// ── Multi-asset payroll orchestration ────────────────────────────────────────

export type StellarAsset = {
  code: string;
  issuer?: string; // undefined for native XLM
};

export type AssetGroupStatus =
  | "pending"
  | "funded"
  | "underfunded"
  | "executing"
  | "succeeded"
  | "failed"
  | "partial";

export interface AssetGroupEmployee {
  employeeId: string;
  name: string;
  address: string;
  amount: number;
  /** SHA-256 commitment of the salary — never expose the raw amount to unauthorized viewers */
  salaryCommitment: string;
}

export interface TreasuryReadiness {
  asset: StellarAsset;
  requiredAmount: number;
  availableBalance: number;
  isFunded: boolean;
  shortfall: number;
}

export interface AssetGroup {
  asset: StellarAsset;
  employees: AssetGroupEmployee[];
  totalAmount: number;
  transactionCount: number;
  status: AssetGroupStatus;
  txHash?: string;
  errorMessage?: string;
  executedAt?: string;
  treasuryReadiness: TreasuryReadiness;
}

export type MultiAssetRunStatus =
  | "draft"
  | "ready"
  | "underfunded"
  | "executing"
  | "succeeded"
  | "partial"
  | "failed";

export interface MultiAssetPayrollRun {
  id: string;
  companyId: string;
  label: string;
  createdAt: string;
  executedAt?: string;
  status: MultiAssetRunStatus;
  assetGroups: AssetGroup[];
  totalEmployees: number;
  /** Opaque ZK proof covering all groups */
  proof?: string;
  proofStatus: "none" | "generating" | "ready" | "expired";
}

export type ReconciliationGroupStatus =
  | "complete"
  | "partial"
  | "failed"
  | "pending";

export interface ReconciliationEntry {
  employeeId: string;
  name: string;
  assetCode: string;
  expectedAmount: number;
  confirmedAmount: number;
  status: "confirmed" | "discrepancy" | "missing";
  txHash?: string;
  confirmedAt?: string;
}

export interface MultiAssetReconciliation {
  runId: string;
  generatedAt: string;
  groups: Array<{
    asset: StellarAsset;
    status: ReconciliationGroupStatus;
    entries: ReconciliationEntry[];
    totalExpected: number;
    totalConfirmed: number;
    discrepancyCount: number;
    /**
     * Rounding safeguard (#667): the difference between `totalConfirmed`
     * and the sum of each entry's amount independently rounded to the
     * nearest Stellar stroop (7 decimals). A nonzero value here is expected
     * dust from per-payment rounding, not a missing payment — callers
     * should surface it separately from `discrepancyCount`, which counts
     * entries that are actually missing or mismatched.
     */
    roundingDust: number;
    /** True when `roundingDust` exceeds the expected bound for this group's payment count. */
    roundingDriftExceeded: boolean;
  }>;
  canExportAudit: boolean;
}

// ─── Payroll Lock Reason (#221) ──────────────────────────────────────────────

export type PayrollLockReasonType =
  | "insufficient_treasury"
  | "pending_approval"
  | "zk_proof_failed"
  | "employee_data_changed"
  | "network_error"
  | "manual_freeze"
  | "compliance_hold";

export interface PayrollLock {
  id: string;
  payrollId: string;
  reasonType: PayrollLockReasonType;
  reasonDescription: string;
  lockedAt: string;
  lockedBy: string;
  /** Human-readable instruction on what action can safely unlock or advance this payroll. */
  resolutionAction: string;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

// ─── Recurring Payroll Template (#220) ───────────────────────────────────────

export type PayrollFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface PayrollTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  frequency: PayrollFrequency;
  employeeIds: string[];
  dayOfMonth?: number; // 1-31, for monthly/quarterly
  dayOfWeek?: number; // 0=Sun..6=Sat, for weekly/biweekly
  isActive: boolean;
  lastExecuted?: string | null;
  nextScheduled?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Overdue Payroll Alert (#219) ────────────────────────────────────────────

export type OverdueAlertSeverity = "warning" | "critical";

export interface OverduePayrollAlert {
  id: string;
  payrollId: string;
  payrollName: string;
  scheduledDate: string;
  dueDate: string;
  severity: OverdueAlertSeverity;
  reason: string;
  totalAmount: number;
  employeeCount: number;
  daysOverdue: number;
}

// ─── Approval Comment History (#222) ─────────────────────────────────────────

export type ApprovalAction =
  | "approved"
  | "rejected"
  | "requested_changes"
  | "commented"
  | "submitted";

export interface ApprovalComment {
  id: string;
  payrollId: string;
  action: ApprovalAction;
  comment: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentMetadata?: PayrollAttachmentMetadata | null;
}

export interface PayrollAttachmentMetadata {
  fileName: string;
  uploadedAt: string;
  owner: string;
  checksum: string;
  accessScope: "read-only" | "full-audit";
}
// ─── Payroll Dispute Resolution Queue (#317) ──────────────────────────────────

export type DisputeStatus = "active" | "overdue" | "resolved" | "escalated";

export type DisputeResolutionAction = "resolve" | "escalate" | "dismiss";

export type DisputeBlockedAction =
  | "finalization"
  | "approval"
  | "execution"
  | "reconciliation"
  | "audit_export";

export interface PayrollDispute {
  id: string;
  payrollPeriod: string;
  payrollBatch: string;
  status: DisputeStatus;
  resolutionDeadline: string;
  safeReasonCode: PayrollLockReasonType;
  safeReasonDescription: string;
  blockedActions: DisputeBlockedAction[];
  requiredReviewer: UserRole;
  resolutionAction: string;
  createdAt: string;
  payrollRunId?: string;
  raisedBy?: string;
  reason?: string;
  isResolved?: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string;
}

// ── Compliance Evidence Bundle ───────────────────────────────────────────────

export interface AuditSafeReceipt {
  receiptId: string;
  payrollRunId: string;
  timestamp: string;
  totalDisbursed: number;
  recipientCount: number;
  recipientCommitments: string[];
  status: "verified" | "pending" | "revoked";
  receiptHash: string;
  signature: string;
}

export interface ProofReference {
  proofId: string;
  verifierContract: string;
  circuitHash: string;
  publicSignalsDigest: string;
  proofStatus: "verified" | "pending" | "failed" | "expired";
  verifiedAt?: string;
  expiresAt: string;
  rawProofHash: string;
}

export interface ComplianceEvidenceBundle {
  bundleId: string;
  payrollRunId: string;
  companyId: string;
  title: string;
  createdAt: string;
  status: "verified" | "pending_review" | "flagged" | "archived";
  classification: "audit-safe-redacted";
  receipts: AuditSafeReceipt[];
  proofReference: ProofReference;
  transactionMetadata: {
    txHash: string;
    network: string;
    ledgerSequence: number;
    feeStroops: number;
    contractAddresses: CompanyContractConfig;
  };
  approvalHistory: ApprovalEvent[];
  verificationStatus: {
    isVerified: boolean;
    verifiedAt: string;
    verifiedBy: string;
    checksPassed: number;
    totalChecks: number;
  };
}

// ─── Payroll Review Risk Scoring (#258) ──────────────────────────────────────

export type RiskFactorType =
  | "treasury_balance"
  | "stale_wallet"
  | "invalid_address"
  | "inactive_employee"
  | "missing_commitment"
  | "high_variance"
  | "new_employee"
  | "large_amount";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  type: RiskFactorType;
  severity: RiskSeverity;
  title: string;
  description: string;
  weight: number;
}

export interface PayrollRiskScore {
  payrollId: string;
  overallScore: number;
  riskLevel: "clear" | "caution" | "warning" | "block";
  factors: RiskFactor[];
  calculatedAt: string;
}

// ─── Employee Onboarding Readiness Tracker (#259) ─────────────────────────────

export type OnboardingStep =
  | "wallet_connected"
  | "identity_verified"
  | "salary_set"
  | "commitment_generated"
  | "active_status";

export type OnboardingStepStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "failed";

export interface EmployeeOnboardingStep {
  step: OnboardingStep;
  label: string;
  status: OnboardingStepStatus;
  completedAt?: string;
  error?: string;
}

export interface EmployeeOnboardingReadiness {
  employeeId: string;
  name: string;
  overallStatus: "not_ready" | "partial" | "ready";
  steps: EmployeeOnboardingStep[];
  readyForPayroll: boolean;
  completedCount: number;
  totalCount: number;
}

// ─── Treasury Drain Simulation Warning (#260) ─────────────────────────────────

export interface TreasuryDrainConfig {
  reserveThreshold: number;
  emergencyReserve: number;
  warningEnabled: boolean;
}

export interface TreasuryDrainSimulation {
  currentBalance: number;
  projectedDrain: number;
  remainingAfterDrain: number;
  reserveThreshold: number;
  emergencyReserve: number;
  wouldExceedReserve: boolean;
  wouldExceedEmergency: boolean;
  severity: "safe" | "warning" | "critical";
  message: string;
}

// ─── Auditor-Ready Payroll Timeline (#261) ────────────────────────────────────

export type AuditTimelineEventType =
  | "run_initiated"
  | "employees_selected"
  | "proof_generated"
  | "treasury_verified"
  | "approval_received"
  | "transaction_submitted"
  | "block_confirmed"
  | "reconciliation_completed"
  | "run_failed";

export interface AuditTimelineEvent {
  id: string;
  type: AuditTimelineEventType;
  timestamp: string;
  actor: string;
  /** Privacy-safe description — never includes raw salary amounts */
  summary: string;
  /** Hash of event details for tamper-proofing */
  eventHash: string;
  /** Optional metadata — all values are commitments or hashes, not raw data */
  metadata?: Record<string, string>;
}

export interface AuditReadyTimeline {
  payrollId: string;
  companyId: string;
  events: AuditTimelineEvent[];
  /** Merkle root of all event hashes for verification */
  timelineRoot: string;
  generatedAt: string;
  /** Whether this timeline has been exported for audit */
  exported: boolean;
}

// ─── Wallet Rotation Approval Timeline (#262) ────────────────────────────────

export type WalletRotationEventType =
  | "rotation_requested"
  | "approval_granted"
  | "approval_rejected"
  | "cooldown_activated"
  | "cooldown_expired"
  | "emergency_override"
  | "rotation_completed"
  | "rotation_failed";

export type WalletRotationReasonCode =
  | "key_compromise"
  | "device_loss"
  | "scheduled_rotation"
  | "compliance_requirement"
  | "emergency";

export interface WalletRotationEvent {
  id: string;
  employeeId: string;
  type: WalletRotationEventType;
  timestamp: string;
  actor: string;
  reasonCode: WalletRotationReasonCode;
  previousWallet: string;
  newWallet?: string;
  /** Human-readable description — wallet addresses are masked by default */
  summary: string;
  metadata?: Record<string, string>;
}

export interface WalletRotationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  previousWallet: string;
  newWallet: string;
  reasonCode: WalletRotationReasonCode;
  requestedBy: string;
  requestedAt: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cooldown"
    | "completed"
    | "failed";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  cooldownEndsAt?: string;
  isEmergency?: boolean;
  events: WalletRotationEvent[];
  metadata?: Record<string, string>;
}

export interface WalletRotationCooldown {
  employeeId: string;
  rotationId: string;
  activatedAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface WalletRotationWarning {
  type: "cooldown_active" | "payroll_blocker" | "pending_approval";
  message: string;
  severity: "info" | "warning" | "critical";
}

// ─── Compliance Evidence Pointer Manager (#338) ──────────────────────────────

export type EvidencePointerType =
  | "url"
  | "ipfs"
  | "document-hash"
  | "case-reference";

export type EvidencePointerStatus = "valid" | "invalid" | "pending";

export interface ComplianceEvidencePointer {
  id: string;
  /** Review case this pointer is attached to — e.g. an audit or dispute case id */
  reviewCaseId: string;
  /** Payroll period/run this evidence pertains to */
  payrollRunId: string;
  pointerType: EvidencePointerType;
  /**
   * Reference to where the evidence lives (URL, IPFS CID, document hash, or
   * external case reference number). Never the evidence content itself —
   * this app never stores or displays raw evidence.
   */
  reference: string;
  description: string;
  status: EvidencePointerStatus;
  /** Populated when status is "invalid" */
  validationError?: string;
  createdAt: string;
  createdBy: string;
}

// ─── Payroll Schedule Calendar Editor (#339) ─────────────────────────────────

/**
 * A draft, unsaved edit to a recurring payroll template's settlement window
 * — proposed before being submitted as the template's new policy. Kept
 * separate from `PayrollTemplate` itself so the calendar editor can preview
 * changes without mutating the live schedule.
 */
export interface DraftSettlementWindow {
  id: string;
  templateId: string;
  /** ISO date (yyyy-mm-dd) the settlement window opens */
  windowStart: string;
  /** ISO date (yyyy-mm-dd) the settlement window closes */
  windowEnd: string;
  createdAt: string;
}

// ─── Approver Threshold Rotation (#340) ──────────────────────────────────────

/**
 * A versioned approval-threshold policy: how many approvers must sign off
 * on a payroll batch before it can execute. Rotating the threshold creates
 * a new version rather than mutating the old one, so batches already locked
 * to a prior version keep their original requirement — see
 * `ApproverThresholdRotationRequest.affectedBatchIds`.
 */
export interface ApproverThresholdPolicy {
  companyId: string;
  version: number;
  requiredApprovals: number;
  effectiveFrom: string;
  createdBy: string;
}

export type ThresholdRotationStatus = "pending" | "confirmed" | "cancelled";

export interface ApproverThresholdRotationRequest {
  id: string;
  companyId: string;
  currentPolicy: ApproverThresholdPolicy;
  proposedRequiredApprovals: number;
  /** Payroll batch ids already locked to `currentPolicy.version` — they keep the old threshold. */
  affectedBatchIds: string[];
  status: ThresholdRotationStatus;
  createdAt: string;
  createdBy: string;
  confirmedAt?: string | null;
}

// ─── Period Close Reconciliation Dashboard (#341) ────────────────────────────

export interface FundingReservation {
  id: string;
  payrollRunId: string;
  amount: number;
  purpose: string;
  isReleased: boolean;
  releasedAt?: string | null;
}

export type PeriodCloseBlockerCategory =
  | "holds"
  | "disputes"
  | "funding_reservations"
  | "audit_references"
  | "settlement"
  | "reconciliation"
  | "receipt_review"
  | "audit_handoff";

export interface PeriodCloseBlocker {
  category: PeriodCloseBlockerCategory;
  description: string;
}

export interface PeriodCloseChecklistItem {
  category: PeriodCloseBlockerCategory;
  label: string;
  isSatisfied: boolean;
  blockers: PeriodCloseBlocker[];
}

export interface PeriodCloseChecklist {
  payrollRunId: string;
  items: PeriodCloseChecklistItem[];
  canClose: boolean;
}

// ── Exception Triage Dashboard Types (Issue #262) ───────────────────────────

export type ExceptionSeverity = "blocking" | "warning" | "info";
export type ExceptionCategory =
  | "zk_proof"
  | "compliance"
  | "treasury"
  | "employee_data"
  | "network"
  | "reconciliation";

export type ExceptionSource =
  | "circuit_verifier"
  | "wallet_router"
  | "compliance_check"
  | "treasury_guard"
  | "batch_parser"
  | "oracle_bridge";

export type ExceptionStatus =
  | "open"
  | "investigating"
  | "resolved"
  | "dismissed";

export interface PayrollTriageException {
  id: string;
  runId: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  source: ExceptionSource;
  employeeCount: number;
  affectedEmployees?: Array<{
    id: string;
    name: string;
    department?: string;
    /** Redacted salary commitment for privacy */
    salaryCommitmentHash: string;
  }>;
  suggestedAction: string;
  nextStepUrl?: string;
  createdAt: string;
  resolvedAt?: string | null;
  /** Encrypted or redacted token for proof debugging */
  redactedProofDigest?: string;
}

/**
 * Payment instruction in a payroll run or disbursement batch (#633).
 *
 * Represents an individual payment directive specifying recipient, destination,
 * amount, and asset for on-chain settlement.
 */
export interface PaymentInstruction {
  /** Unique instruction identifier or reference code (e.g. "INS-001"). */
  id?: string;
  /** Employee or recipient identifier (e.g. "emp_001"). */
  employeeId: string;
  /** Destination Stellar wallet address (e.g. G...). */
  recipientAddress?: string;
  /** Compatibility alias for recipientAddress. */
  address?: string;
  /** Compatibility alias for recipientAddress. */
  walletAddress?: string;
  /** Payout amount. */
  amount?: number;
  /** Compatibility alias for amount. */
  salary?: number;
  /** Payout asset code (e.g. "USDC", "XLM", "EURC"). Defaults to "USDC". */
  asset?: string;
  /** Compatibility alias for asset. */
  assetCode?: string;
  /** Non-sensitive recipient display name. */
  name?: string;
  /** Optional payment memo, batch reference, or cycle identifier. */
  reference?: string;
  /** Optional department or category tag. */
  department?: string;
  /** Optional metadata tags. */
  metadata?: Record<string, unknown>;
}

export type PaymentInstructionDuplicateKind =
  | "instruction_id"
  | "recipient"
  | "address"
  | "exact_match"
  | "collision";

export interface PaymentInstructionDuplicateGroup {
  kind: PaymentInstructionDuplicateKind;
  /** The value that repeats (e.g. instruction id, recipientId, masked address, or signature). */
  value: string;
  /** Actionable error or warning message explaining the duplicate. */
  message: string;
  /** Specific guidance on how to fix this issue. */
  actionableRemediation: string;
  /** Whether this issue blocks payroll submission. */
  isBlocking: boolean;
  /** The affected instructions in the order they appear. */
  instructions: PaymentInstruction[];
}

export interface PaymentInstructionDuplicateOptions {
  /**
   * Existing historical or confirmed instruction identifiers / references
   * to check against for collision detection (e.g., from prior payroll runs).
   */
  existingInstructionIds?: string[];
  /**
   * Existing historical or confirmed batch references.
   */
  existingReferences?: string[];
  /**
   * When true, multiple instructions sharing the same destination address
   * across different employees are treated as blocking errors rather than warnings.
   * Default: false (warning).
   */
  strictAddressUniqueness?: boolean;
  /**
   * When true, permits multiple instructions for the same employeeId
   * provided they disburse different assets (e.g. XLM + USDC).
   * Default: false (same employeeId cannot appear more than once).
   */
  allowMultiAssetForSameRecipient?: boolean;
}

export interface PaymentInstructionValidationResult {
  /** True when there are no blocking duplicate errors. */
  isValid: boolean;
  /** True when any duplicate (blocking or warning) is detected. */
  hasDuplicates: boolean;
  /** True when at least one blocking duplicate is present. */
  isBlocking: boolean;
  /** List of detected duplicate groups. */
  duplicateGroups: PaymentInstructionDuplicateGroup[];
  /** High-level summary of findings, or null if no duplicates. */
  summaryMessage: string | null;
}

/**
 * Lifecycle status of a payroll import batch (#686).
 *
 * - `pending`   – import was received but not yet committed.
 * - `completed` – import was committed to payroll records.
 * - `rolled_back` – import was rolled back to the pre-import snapshot.
 * - `failed`    – import failed before or during commitment.
 */
export type PayrollImportBatchStatus = "pending" | "completed" | "rolled_back" | "failed";

/**
 * A payroll import batch reduced to its rollback-relevant facts.
 *
 * Intentionally minimal: the batch carries only its id, timing, count, and a
 * pre-import snapshot reference. Salary amounts, employee identities, and
 * wallet addresses are not part of this contract.
 */
export interface PayrollImportBatch {
  /** Internal import batch id, e.g. "import_2026-10-01_01". */
  id: string;
  /** ISO timestamp when the import was received. */
  importedAt: string;
  /** Number of payroll records in the import. */
  recordCount: number;
  /** Reference to the pre-import snapshot, present once committed. */
  snapshotId?: string | null;
  /** Current lifecycle status of the batch. */
  status: PayrollImportBatchStatus;
  /** ISO timestamp when the batch was completed, if applicable. */
  completedAt?: string | null;
}

/**
 * Policy governing when a completed payroll import may be rolled back.
 */
export interface PayrollImportRollbackPolicy {
  /** Maximum age in hours after completion within which rollback is allowed. */
  maxRollbackAgeHours: number;
  /** Whether rollback is allowed after the import has been executed on-chain. */
  allowRollbackAfterExecution: boolean;
  /** Whether rollback is allowed once a reconciliation has started. */
  allowRollbackAfterReconciliation: boolean;
}

/**
 * Decision on whether a payroll import batch may be rolled back.
 */
export interface PayrollImportRollbackDecision {
  /** True when the rollback is permitted. */
  allowed: boolean;
  /** Machine-readable reason when rollback is not permitted. */
  reason?: "batch_not_completed" | "rollback_window_expired" | "executed_on_chain" | "reconciliation_started" | "unknown_batch";
  /** Human-readable explanation of the decision. */
  message: string;
  /** Remaining rollback window in hours, null when not applicable. */
  remainingWindowHours?: number | null;
}

/**
 * Result of evaluating rollback eligibility for a payroll import batch.
 */
export interface PayrollImportRollbackEvaluation {
  /** The batch that was evaluated. */
  batch: PayrollImportBatch;
  /** Whether rollback is permitted. */
  allowed: boolean;
  /** Decision with reason and message. */
  decision: PayrollImportRollbackDecision;
  /** Whether the batch can still be rolled back (same as allowed). */
  canRollback: boolean;
}

/** Default rollback policy: 24-hour window, no on-chain or post-reconciliation rollback. */
export const DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY: PayrollImportRollbackPolicy = {
  maxRollbackAgeHours: 24,
  allowRollbackAfterExecution: false,
  allowRollbackAfterReconciliation: false,
};

// ─── Payroll Upload Recovery Checkpoints ─────────────────────────────────────

/**
 * The stage of a payroll upload at which a checkpoint was recorded.
 *
 * Mirrors the four wizard steps plus a terminal state so the recovery
 * banner can direct the operator to the exact point of interruption.
 *
 * - `draft_started`   – employee selection and amount review are complete.
 * - `proof_generated` – ZK proof was produced and validated.
 * - `confirmed`       – operator reviewed and confirmed the proof step.
 * - `submitting`      – transaction dispatch was in flight when interrupted.
 * - `completed`       – upload finished successfully; no recovery needed.
 */
export type UploadCheckpointStage =
  | "draft_started"
  | "proof_generated"
  | "confirmed"
  | "submitting"
  | "completed";

/**
 * A privacy-safe snapshot of payroll upload progress written at each
 * meaningful wizard transition.
 *
 * Sensitive fields — employee amounts, salaries, ZK proofs, wallet keys —
 * are intentionally excluded. Only structural metadata safe to store
 * client-side or transmit to a logging endpoint is recorded.
 */
export interface UploadCheckpoint {
  /** Opaque run identifier generated when the wizard session starts. */
  runId: string;
  /** Upload stage this checkpoint represents. */
  stage: UploadCheckpointStage;
  /**
   * Number of employees in the batch — count only, never IDs or amounts.
   * A zero value means no employees were locked in at checkpoint time.
   */
  employeeCount: number;
  /** Whether a valid ZK proof existed when this checkpoint was written. */
  proofReady: boolean;
  /** ISO-8601 timestamp when the checkpoint was recorded. */
  savedAt: string;
  /**
   * Human-readable hint surfaced in the recovery banner.
   * Must not contain salary figures, wallet addresses, or employee names.
   */
  recoveryHint: string;
}

/**
 * Result returned by the checkpoint API on a GET request.
 * Wraps the latest checkpoint plus staleness metadata.
 */
export interface UploadCheckpointQueryResult {
  checkpoint: UploadCheckpoint | null;
  /** True when a recoverable (non-completed) checkpoint exists. */
  isRecoverable: boolean;
  /**
   * Age in seconds since the checkpoint was saved.
   * Null when no checkpoint exists.
   */
  ageSeconds: number | null;
}

// ─── Payroll Draft Provenance ─────────────────────────────────────────────────

/**
 * The kind of change that produced a draft provenance entry.
 *
 * `created` is recorded once when a draft is first saved; `updated` is
 * recorded on every subsequent mutation so operators can trace a draft's
 * chain of custody back to its origin.
 */
export type DraftProvenanceAction = "created" | "updated";

/**
 * One link in a payroll draft's chain of custody.
 *
 * Provenance records *who* touched a draft and *when*, plus a one-way content
 * digest so any change to the draft's contents is detectable. It never
 * reversibly stores salary amounts, employee IDs, wallet addresses, or ZK
 * commitments — only structural metadata and the digest are retained.
 */
export interface DraftProvenanceEntry {
  /** What happened: the draft was created or updated. */
  action: DraftProvenanceAction;
  /** Identity of the actor who made the change; defaults to "system" when omitted. */
  actor: string;
  /** ISO-8601 timestamp when the change was recorded. */
  timestamp: string;
  /**
   * Privacy-safe content digest of the draft at change time.
   * One-way hash of structural fields only — used to detect that the draft's
   * contents changed between revisions. Never reversible to payroll data.
   */
  contentChecksum: string;
  /** Human-readable summary of what changed; contains no personal data. */
  changeSummary?: string;
}

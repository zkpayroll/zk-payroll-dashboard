import type { StellarNetwork } from "./stellar";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

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
  /** Optional token (SAC/asset) contract used for disbursements. */
  tokenContractId?: string;
  /** Optional audit/logging settings */
  auditSettings?: {
    enabled: boolean;
    retentionDays?: number;
    requireAuditorApproval?: boolean;
  };
}

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

export interface PayrollTransaction {
  id: string;
  companyId: string;
  timestamp: string;
  createdAt: string; // Added for consistency with API filters
  totalAmount: number;
  employeeCount: number;
  proof: string;
  status: "pending" | "verified" | "failed" | "cancelled";
  approvalStatus?: "draft" | "pending_executive_approval" | "approved" | "rejected";
  approvalHistory?: Array<{
    approvedBy: string;
    approvedAt: string;
    role: string;
    comment?: string;
  }>;
  txHash?: string;
  isArchived?: boolean;
}

export interface PayrollRun extends PayrollTransaction {
  employeeIds: string[];
  executedAt?: string | null;
  transactionHash?: string | null;
  reconciliationStatus?: "pending" | "partial" | "complete" | "failed";
  reconciliationDetails?: {
    processedCount: number;
    totalCount: number;
    discrepancies?: string[];
    lastReconciliedAt?: string;
  };
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
  proof: string | null;
  proofStatus: "idle" | "generating" | "success" | "error";
  proofError: string | null;
  submissionStatus: "idle" | "submitting" | "success" | "error";
  submissionError: string | null;
  transactionHash: string | null;
  isProofNearingExpiration?: boolean;
  treasuryBalanceOverride?: number | null;
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
  status: "pending" | "approved" | "rejected" | "expired" | "revoked" | "export_ready";
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

export type ReconciliationGroupStatus = "complete" | "partial" | "failed" | "pending";

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

export type ApprovalAction = "approved" | "rejected" | "requested_changes" | "commented" | "submitted";

export interface ApprovalComment {
  id: string;
  payrollId: string;
  action: ApprovalAction;
  comment: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  attachmentUrl?: string | null;
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

export type OnboardingStepStatus = "pending" | "in_progress" | "complete" | "failed";

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


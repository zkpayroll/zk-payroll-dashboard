export type ShortfallAction = "block" | "warn" | "require_approval";

export interface SettlementWindowPolicy {
  /** Settlement window duration in hours before payroll executes (e.g., 24). */
  settlementWindowHours: number;
  /** Cutoff lead time in hours required before settlement closes (e.g., 4). */
  cutoffLeadTimeHours: number;
  /** Grace period in hours allowed after scheduled time before expiry (e.g., 12). */
  executionGracePeriodHours: number;
  /** Whether payroll automatically settles once the window passes and approvals are met. */
  autoSettle: boolean;
}

export interface ReserveRulesPolicy {
  /** Minimum reserve buffer required as percentage of projected payroll (e.g., 20%). */
  minReservePercentage: number;
  /** Minimum fixed floor reserve amount in base units (e.g., 25000 XLM/USDC). */
  minReserveFixedAmount: number;
  /** Warning threshold percentage that triggers replenishment alerts (e.g., 15%). */
  replenishThresholdPercentage: number;
  /** Action taken when treasury reserve balance falls below threshold. */
  shortfallPolicy: ShortfallAction;
}

export interface ApprovalRequirementsPolicy {
  /** Number of approvals required before batch can be released (e.g., 2). */
  requiredApprovalsCount: number;
  /** Whether dual executive approval is mandatory. */
  requireDualApproval: boolean;
  /** Payment amount threshold that triggers mandatory dual approval (e.g., 50000). */
  dualApprovalThreshold: number;
  /** Whether the payroll creator/submitter is allowed to self-approve. */
  allowSelfApproval: boolean;
  /** Whether compliance auditor sign-off is required for off-cycle or high-value runs. */
  requireAuditorApproval: boolean;
}

export interface CapacityLimitsPolicy {
  /** Maximum number of employee recipients allowed in a single batch (e.g., 500). */
  maxBatchSize: number;
  /** Maximum total disbursement value allowed in a single batch (e.g., 500000). */
  maxTotalDisbursement: number;
  /** Cumulative 24-hour disbursement cap across all batches (e.g., 1000000). */
  dailyDisbursementLimit: number;
  /** Maximum number of batch runs permitted in a single 24-hour cycle (e.g., 4). */
  maxConsecutiveBatches: number;
}

export interface AuditRetentionPolicy {
  /** Number of days audit logs, proof records, and hashes must be retained (e.g., 365). */
  retentionPeriodDays: number;
  /** Whether to enforce append-only tamper-resistant immutable logging. */
  immutableAuditLog: boolean;
  /** Whether auditor sign-off is required prior to exporting sensitive compliance reports. */
  requireAuditorExportSignoff: boolean;
  /** Whether detailed execution event tracing and ZK telemetry are enabled. */
  detailedTelemetry: boolean;
}

export interface PayrollPolicy {
  id: string;
  companyId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  timing: SettlementWindowPolicy;
  reserves: ReserveRulesPolicy;
  approvals: ApprovalRequirementsPolicy;
  capacity: CapacityLimitsPolicy;
  auditRetention: AuditRetentionPolicy;
}

export type PolicyValidationSeverity = "error" | "warning" | "info";

export interface PolicyValidationIssue {
  id: string;
  section: "timing" | "reserves" | "approvals" | "capacity" | "auditRetention" | "general";
  field?: string;
  severity: PolicyValidationSeverity;
  title: string;
  message: string;
  remediation?: string;
}

export interface PolicyImpactPreview {
  settlementWindowSummary: string;
  reserveProtectionSummary: string;
  governanceSummary: string;
  capacitySummary: string;
  auditComplianceSummary: string;
  riskRating: "low" | "medium" | "high" | "critical";
}

export interface CompiledPolicyResult {
  isValid: boolean;
  hasWarnings: boolean;
  compiledAt: string;
  policyVersion: number;
  compiledDigest: string;
  issues: PolicyValidationIssue[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    errorsCount: number;
    warningsCount: number;
    infoCount: number;
  };
  impactPreview: PolicyImpactPreview;
}

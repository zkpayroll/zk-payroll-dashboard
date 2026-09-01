import type {
  PayrollPolicy,
  CompiledPolicyResult,
  PolicyValidationIssue,
  PolicyImpactPreview,
} from "@/types/policy";

/**
 * Total number of rule assertions executed by the compiler.
 * Used to calculate passed checks metric.
 */
const TOTAL_RULE_CHECKS = 24;

/**
 * Generate a deterministic pseudo-hex digest from policy fields.
 */
function computePolicyDigest(policy: PayrollPolicy): string {
  const payload = JSON.stringify({
    timing: policy.timing,
    reserves: policy.reserves,
    approvals: policy.approvals,
    capacity: policy.capacity,
    auditRetention: policy.auditRetention,
    version: policy.version,
  });

  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `pol_0x${hex}`;
}

/**
 * SDK Policy Compiler
 * Validates, analyzes, and produces a compiled validation preview for a given PayrollPolicy.
 * Identifies blocking critical errors, security warnings, and runtime impact summaries.
 */
export function compilePayrollPolicy(policy: PayrollPolicy): CompiledPolicyResult {
  const issues: PolicyValidationIssue[] = [];

  const { timing, reserves, approvals, capacity, auditRetention } = policy;

  // --- 1. Timing & Settlement Checks ---
  if (timing.settlementWindowHours <= 0) {
    issues.push({
      id: "timing-window-min",
      section: "timing",
      field: "settlementWindowHours",
      severity: "error",
      title: "Invalid settlement window",
      message: "Settlement window must be at least 1 hour to allow network consensus and review.",
      remediation: "Set settlement window to 1 or more hours.",
    });
  } else if (timing.settlementWindowHours < 4) {
    issues.push({
      id: "timing-window-short",
      section: "timing",
      field: "settlementWindowHours",
      severity: "warning",
      title: "Narrow settlement window",
      message: "Settlement window under 4 hours creates a narrow execution margin during network congestion.",
      remediation: "Consider 12–24 hours for standard production payrolls.",
    });
  } else if (timing.settlementWindowHours > 168) {
    issues.push({
      id: "timing-window-long",
      section: "timing",
      field: "settlementWindowHours",
      severity: "warning",
      title: "Excessive settlement window",
      message: "Settlement window exceeding 7 days (168h) may delay disbursements and cause exchange rate drift.",
      remediation: "Cap settlement window to under 7 days.",
    });
  }

  if (timing.cutoffLeadTimeHours < 0) {
    issues.push({
      id: "timing-cutoff-negative",
      section: "timing",
      field: "cutoffLeadTimeHours",
      severity: "error",
      title: "Negative cutoff lead time",
      message: "Cutoff lead time cannot be negative.",
      remediation: "Set cutoff lead time to 0 or more hours.",
    });
  } else if (timing.cutoffLeadTimeHours >= timing.settlementWindowHours && timing.settlementWindowHours > 0) {
    issues.push({
      id: "timing-cutoff-ge-window",
      section: "timing",
      field: "cutoffLeadTimeHours",
      severity: "error",
      title: "Cutoff exceeds settlement window",
      message: "Cutoff lead time must be strictly less than the settlement window.",
      remediation: "Reduce cutoff lead time or extend the settlement window.",
    });
  }

  if (timing.executionGracePeriodHours <= 0) {
    issues.push({
      id: "timing-grace-min",
      section: "timing",
      field: "executionGracePeriodHours",
      severity: "error",
      title: "Invalid execution grace period",
      message: "Execution grace period must be at least 1 hour.",
      remediation: "Provide at least 1 hour for post-settlement execution.",
    });
  }

  if (timing.autoSettle && !approvals.requireDualApproval) {
    issues.push({
      id: "timing-autosettle-warning",
      section: "timing",
      field: "autoSettle",
      severity: "warning",
      title: "Unattended auto-settlement risk",
      message: "Auto-settle is active without mandatory dual approval, reducing oversight for automatic releases.",
      remediation: "Enable dual approval or require manual release confirmation.",
    });
  }

  if (timing.autoSettle) {
    issues.push({
      id: "timing-autosettle-info",
      section: "timing",
      field: "autoSettle",
      severity: "info",
      title: "Auto-settle enabled",
      message: "Disbursements will automatically execute once settlement closes and required approvals are met.",
    });
  }

  // --- 2. Treasury Reserves Checks ---
  if (reserves.minReservePercentage < 0 || reserves.minReservePercentage > 100) {
    issues.push({
      id: "reserves-pct-range",
      section: "reserves",
      field: "minReservePercentage",
      severity: "error",
      title: "Invalid reserve buffer percentage",
      message: "Reserve buffer percentage must be between 0% and 100%.",
      remediation: "Adjust reserve buffer percentage within 0%–100%.",
    });
  } else if (reserves.minReservePercentage < 10) {
    issues.push({
      id: "reserves-pct-low",
      section: "reserves",
      field: "minReservePercentage",
      severity: "warning",
      title: "Low reserve buffer ratio",
      message: "Reserve buffer under 10% increases risk of liquidity failure if payroll estimates increase.",
      remediation: "Maintain at least 15%–20% treasury reserve buffer.",
    });
  }

  if (reserves.minReserveFixedAmount < 0) {
    issues.push({
      id: "reserves-floor-negative",
      section: "reserves",
      field: "minReserveFixedAmount",
      severity: "error",
      title: "Negative reserve floor",
      message: "Fixed reserve floor amount cannot be negative.",
      remediation: "Set fixed floor to 0 or positive amount.",
    });
  }

  if (reserves.replenishThresholdPercentage < 0 || reserves.replenishThresholdPercentage > 100) {
    issues.push({
      id: "reserves-replenish-range",
      section: "reserves",
      field: "replenishThresholdPercentage",
      severity: "error",
      title: "Invalid replenishment threshold",
      message: "Replenishment threshold percentage must be between 0% and 100%.",
      remediation: "Set replenishment threshold between 0% and 100%.",
    });
  } else if (reserves.replenishThresholdPercentage > reserves.minReservePercentage && reserves.minReservePercentage >= 0) {
    issues.push({
      id: "reserves-replenish-exceeds-min",
      section: "reserves",
      field: "replenishThresholdPercentage",
      severity: "error",
      title: "Replenish threshold exceeds reserve buffer",
      message: "Replenishment warning threshold cannot exceed the minimum reserve buffer percentage.",
      remediation: "Set replenishment threshold percentage lower than or equal to minimum reserve percentage.",
    });
  }

  if (reserves.shortfallPolicy === "warn") {
    issues.push({
      id: "reserves-shortfall-warn",
      section: "reserves",
      field: "shortfallPolicy",
      severity: "warning",
      title: "Permissive shortfall policy",
      message: "Permitting payroll to proceed with shortfall warnings only weakens treasury risk controls.",
      remediation: "Select 'block' or 'require_approval' to prevent underfunded releases.",
    });
  } else if (reserves.shortfallPolicy === "block") {
    issues.push({
      id: "reserves-shortfall-block-info",
      section: "reserves",
      field: "shortfallPolicy",
      severity: "info",
      title: "Strict shortfall protection",
      message: "Batches will be strictly blocked from execution if treasury balance falls below required buffer.",
    });
  }

  // --- 3. Approval Requirements Checks ---
  if (approvals.requiredApprovalsCount < 1) {
    issues.push({
      id: "approvals-count-min",
      section: "approvals",
      field: "requiredApprovalsCount",
      severity: "error",
      title: "Missing approval requirement",
      message: "At least 1 approval is mandatory before payroll disbursement can proceed.",
      remediation: "Require at least 1 approver.",
    });
  } else if (approvals.requiredApprovalsCount > 10) {
    issues.push({
      id: "approvals-count-max",
      section: "approvals",
      field: "requiredApprovalsCount",
      severity: "error",
      title: "Excessive approval count",
      message: "Approval requirement cannot exceed 10 signatories.",
      remediation: "Set required approvals count between 1 and 10.",
    });
  }

  if (approvals.allowSelfApproval && approvals.requiredApprovalsCount === 1) {
    issues.push({
      id: "approvals-self-single-error",
      section: "approvals",
      field: "allowSelfApproval",
      severity: "error",
      title: "Critical separation-of-duties violation",
      message: "Submitter self-approval is strictly prohibited when only 1 approval is required.",
      remediation: "Disable self-approval or require at least 2 independent approvers.",
    });
  } else if (approvals.allowSelfApproval) {
    issues.push({
      id: "approvals-self-warning",
      section: "approvals",
      field: "allowSelfApproval",
      severity: "warning",
      title: "Self-approval permitted",
      message: "Payroll creator may approve their own submissions. All self-approvals will be flagged in audit logs.",
      remediation: "Disable self-approval for stricter segregation of duties.",
    });
  }

  if (approvals.requiredApprovalsCount === 1 && !approvals.allowSelfApproval) {
    issues.push({
      id: "approvals-single-warning",
      section: "approvals",
      field: "requiredApprovalsCount",
      severity: "warning",
      title: "Single approver bottleneck",
      message: "Single-approval policy creates an operational bottleneck and lacks dual-party verification.",
      remediation: "Require at least 2 approvals for production governance.",
    });
  }

  if (approvals.dualApprovalThreshold <= 0) {
    issues.push({
      id: "approvals-dual-threshold-min",
      section: "approvals",
      field: "dualApprovalThreshold",
      severity: "error",
      title: "Invalid dual approval threshold",
      message: "Dual approval threshold amount must be greater than 0.",
      remediation: "Set dual approval threshold to a positive disbursement value.",
    });
  }

  if (!approvals.requireAuditorApproval) {
    issues.push({
      id: "approvals-auditor-warning",
      section: "approvals",
      field: "requireAuditorApproval",
      severity: "warning",
      title: "Auditor sign-off omitted",
      message: "Auditor approval requirement is disabled. Off-cycle audits will only occur post-settlement.",
      remediation: "Enable auditor approval for enhanced enterprise compliance.",
    });
  }

  if (approvals.requireDualApproval) {
    issues.push({
      id: "approvals-dual-info",
      section: "approvals",
      field: "requireDualApproval",
      severity: "info",
      title: "Dual approval enabled",
      message: `Mandatory dual approval is enforced for all payroll runs exceeding ${approvals.dualApprovalThreshold.toLocaleString()} units.`,
    });
  }

  // --- 4. Capacity Limits Checks ---
  if (capacity.maxBatchSize < 1) {
    issues.push({
      id: "capacity-batch-min",
      section: "capacity",
      field: "maxBatchSize",
      severity: "error",
      title: "Invalid batch size limit",
      message: "Maximum batch size must be at least 1 employee recipient.",
      remediation: "Set maximum batch size to 1 or more.",
    });
  } else if (capacity.maxBatchSize > 5000) {
    issues.push({
      id: "capacity-batch-max",
      section: "capacity",
      field: "maxBatchSize",
      severity: "error",
      title: "Batch size exceeds contract limit",
      message: "Soroban contract transaction limits cap batch capacity at 5,000 employees.",
      remediation: "Limit batch size to 5,000 or fewer recipients.",
    });
  } else if (capacity.maxBatchSize > 1000) {
    issues.push({
      id: "capacity-batch-large-warning",
      section: "capacity",
      field: "maxBatchSize",
      severity: "warning",
      title: "High batch size latency",
      message: "Batches over 1,000 recipients may experience elevated ZK proof generation times.",
      remediation: "Recommend splitting large payrolls into sub-batches of 500.",
    });
  }

  if (capacity.maxTotalDisbursement <= 0) {
    issues.push({
      id: "capacity-disbursement-min",
      section: "capacity",
      field: "maxTotalDisbursement",
      severity: "error",
      title: "Invalid batch disbursement limit",
      message: "Maximum disbursement per batch must be greater than 0.",
      remediation: "Set maximum batch disbursement limit to a positive amount.",
    });
  }

  if (capacity.dailyDisbursementLimit <= 0) {
    issues.push({
      id: "capacity-daily-min",
      section: "capacity",
      field: "dailyDisbursementLimit",
      severity: "error",
      title: "Invalid daily disbursement limit",
      message: "Daily disbursement limit must be greater than 0.",
      remediation: "Set daily disbursement limit to a positive amount.",
    });
  } else if (
    capacity.maxTotalDisbursement > 0 &&
    capacity.dailyDisbursementLimit < capacity.maxTotalDisbursement
  ) {
    issues.push({
      id: "capacity-daily-lt-batch",
      section: "capacity",
      field: "dailyDisbursementLimit",
      severity: "error",
      title: "Daily limit less than batch limit",
      message: "Daily disbursement limit cannot be less than the single-batch disbursement limit.",
      remediation: "Increase daily disbursement limit to at least equal the single-batch limit.",
    });
  }

  if (capacity.maxConsecutiveBatches < 1) {
    issues.push({
      id: "capacity-consecutive-min",
      section: "capacity",
      field: "maxConsecutiveBatches",
      severity: "error",
      title: "Invalid consecutive batch limit",
      message: "Maximum consecutive batches must be at least 1.",
      remediation: "Set consecutive batches to at least 1.",
    });
  } else if (capacity.maxConsecutiveBatches > 10) {
    issues.push({
      id: "capacity-consecutive-high",
      section: "capacity",
      field: "maxConsecutiveBatches",
      severity: "warning",
      title: "High consecutive batch frequency",
      message: "Allowing more than 10 batches in 24 hours may exceed standard Soroban RPC rate thresholds.",
      remediation: "Consider capping daily batch runs to 6–8.",
    });
  }

  // --- 5. Audit & Retention Checks ---
  if (auditRetention.retentionPeriodDays < 30) {
    issues.push({
      id: "audit-retention-min",
      section: "auditRetention",
      field: "retentionPeriodDays",
      severity: "error",
      title: "Audit retention period too short",
      message: "Regulatory compliance mandates a minimum audit retention period of 30 days.",
      remediation: "Set audit retention period to 30 or more days.",
    });
  } else if (auditRetention.retentionPeriodDays > 3650) {
    issues.push({
      id: "audit-retention-max",
      section: "auditRetention",
      field: "retentionPeriodDays",
      severity: "error",
      title: "Audit retention exceeds maximum",
      message: "Audit retention period cannot exceed 10 years (3,650 days).",
      remediation: "Set retention period between 30 and 3,650 days.",
    });
  } else if (auditRetention.retentionPeriodDays < 180) {
    issues.push({
      id: "audit-retention-recommended",
      section: "auditRetention",
      field: "retentionPeriodDays",
      severity: "warning",
      title: "Below industry retention standard",
      message: "Retention under 180 days may not satisfy financial compliance standards (recommended: ≥365 days).",
      remediation: "Increase retention to at least 365 days.",
    });
  }

  if (!auditRetention.immutableAuditLog) {
    issues.push({
      id: "audit-immutable-disabled",
      section: "auditRetention",
      field: "immutableAuditLog",
      severity: "warning",
      title: "Mutable audit logs active",
      message: "Immutable audit logging is disabled. Changes to historical proof trails could go undetected.",
      remediation: "Enable immutable audit logging for enterprise integrity.",
    });
  } else {
    issues.push({
      id: "audit-immutable-info",
      section: "auditRetention",
      field: "immutableAuditLog",
      severity: "info",
      title: "Tamper-resistant audit active",
      message: "All policy checks, proof commitments, and signatures are immutably logged on-chain.",
    });
  }

  if (!auditRetention.requireAuditorExportSignoff) {
    issues.push({
      id: "audit-export-signoff-warning",
      section: "auditRetention",
      field: "requireAuditorExportSignoff",
      severity: "warning",
      title: "Unrestricted audit exports",
      message: "Export sign-off requirement is disabled; sensitive payroll logs can be downloaded without auditor review.",
      remediation: "Enable auditor export sign-off for strict confidentiality controls.",
    });
  }

  // --- Aggregate Summary and Impact Preview ---
  const errorsCount = issues.filter((i) => i.severity === "error").length;
  const warningsCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;
  const isValid = errorsCount === 0;
  const hasWarnings = warningsCount > 0;
  const passedChecks = Math.max(0, TOTAL_RULE_CHECKS - errorsCount - warningsCount);

  let riskRating: PolicyImpactPreview["riskRating"] = "low";
  if (errorsCount > 0) {
    riskRating = "critical";
  } else if (warningsCount >= 3) {
    riskRating = "high";
  } else if (warningsCount > 0) {
    riskRating = "medium";
  }

  const impactPreview: PolicyImpactPreview = {
    settlementWindowSummary: `${timing.settlementWindowHours}h settlement window with ${timing.cutoffLeadTimeHours}h cutoff (${timing.autoSettle ? "Auto-settle active" : "Manual release required"})`,
    reserveProtectionSummary: `${reserves.minReservePercentage}% buffer (${reserves.minReserveFixedAmount.toLocaleString()} fixed floor, ${reserves.shortfallPolicy === "block" ? "Strict block on shortfall" : reserves.shortfallPolicy === "warn" ? "Warning on shortfall" : "Requires override on shortfall"})`,
    governanceSummary: `${approvals.requiredApprovalsCount} approver(s) required${approvals.requireDualApproval ? `, Dual approval at ≥ ${approvals.dualApprovalThreshold.toLocaleString()}` : ""}${approvals.allowSelfApproval ? " [Self-approval allowed]" : " [Self-approval blocked]"}`,
    capacitySummary: `Max ${capacity.maxBatchSize} recipients / ${capacity.maxTotalDisbursement.toLocaleString()} per batch (24h cap: ${capacity.dailyDisbursementLimit.toLocaleString()})`,
    auditComplianceSummary: `${auditRetention.retentionPeriodDays} days retention (${auditRetention.immutableAuditLog ? "Immutable log" : "Mutable log"}, ${auditRetention.requireAuditorExportSignoff ? "Auditor signoff required" : "Direct export permitted"})`,
    riskRating,
  };

  return {
    isValid,
    hasWarnings,
    compiledAt: new Date().toISOString(),
    policyVersion: policy.version,
    compiledDigest: computePolicyDigest(policy),
    issues,
    summary: {
      totalChecks: TOTAL_RULE_CHECKS,
      passedChecks,
      errorsCount,
      warningsCount,
      infoCount,
    },
    impactPreview,
  };
}

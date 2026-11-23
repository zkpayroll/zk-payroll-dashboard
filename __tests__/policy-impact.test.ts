import { describe, expect, it } from "vitest";
import { analyzePayrollPolicyImpact } from "@/src/payroll/policyImpact";
import type { PayrollPolicy } from "@/types/policy";

const policy = (overrides: Partial<PayrollPolicy> = {}): PayrollPolicy => ({
  id: "policy-1",
  companyId: "company-1",
  version: 1,
  updatedAt: "2026-10-18T00:00:00Z",
  updatedBy: "operator-1",
  timing: { settlementWindowHours: 24, cutoffLeadTimeHours: 4, executionGracePeriodHours: 12, autoSettle: false },
  reserves: { minReservePercentage: 20, minReserveFixedAmount: 25000, replenishThresholdPercentage: 15, shortfallPolicy: "block" },
  approvals: { requiredApprovalsCount: 2, requireDualApproval: true, dualApprovalThreshold: 50000, allowSelfApproval: false, requireAuditorApproval: false },
  capacity: { maxBatchSize: 500, maxTotalDisbursement: 500000, dailyDisbursementLimit: 1000000, maxConsecutiveBatches: 4 },
  auditRetention: { retentionPeriodDays: 365, immutableAuditLog: true, requireAuditorExportSignoff: true, detailedTelemetry: true },
  ...overrides,
});

describe("analyzePayrollPolicyImpact", () => {
  it("identifies changed policy sections without exposing values", () => {
    const result = analyzePayrollPolicyImpact(policy(), policy({ capacity: { ...policy().capacity, maxBatchSize: 250 } }));
    expect(result.changedSections).toEqual(["capacity"]);
    expect(result.requiresReview).toBe(true);
    expect(result.summary).toContain("capacity");
    expect(result.summary).not.toContain("250");
  });

  it("reports no impact for identical policies", () => {
    expect(analyzePayrollPolicyImpact(policy(), policy())).toMatchObject({ changedSections: [], requiresReview: false });
  });
});
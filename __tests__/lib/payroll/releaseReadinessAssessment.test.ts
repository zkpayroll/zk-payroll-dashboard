import { describe, it, expect } from "vitest";
import {
  assessReleaseReadiness,
  formatReadinessReport,
  type ReleaseReadinessResult,
} from "@/lib/payroll/releaseReadinessAssessment";
import type { PayrollTransaction } from "@/types/models";

// Test fixture factory
function createMockTransaction(
  overrides: Partial<PayrollTransaction> = {}
): PayrollTransaction {
  return {
    id: "tx-123",
    employeeId: "emp-456",
    amount: "1000.00",
    currency: "USD",
    status: "verified",
    approvalStatus: "approved",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as PayrollTransaction;
}

describe("assessReleaseReadiness", () => {
  describe("successful path", () => {
    it("should mark as ready when all transactions are settled", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "verified" }),
      ];

      const result = assessReleaseReadiness(transactions);

      expect(result.ready).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.metrics.settledCount).toBe(3);
      expect(result.metrics.totalTransactions).toBe(3);
    });

    it("should mark as ready with 80%+ settlement rate", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "cancelled" }), // 4/5 = 80%
      ];

      const result = assessReleaseReadiness(transactions);

      expect(result.ready).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe("failure path", () => {
    it("should block when period is empty", () => {
      const result = assessReleaseReadiness([]);

      expect(result.ready).toBe(false);
      expect(result.blockers).toContain(
        "Payroll period is empty — no transactions to release"
      );
    });

    it("should block when drafts remain", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ approvalStatus: "draft", status: "pending" }),
      ];

      const result = assessReleaseReadiness(transactions);

      expect(result.ready).toBe(false);
      expect(result.blockers.some((b) => b.includes("draft"))).toBe(true);
      expect(result.metrics.draftCount).toBe(1);
    });

    it("should block when settlement rate is below threshold", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }), // 1 settled
        createMockTransaction({ status: "pending" }), // 3 locked
        createMockTransaction({ status: "pending" }),
        createMockTransaction({ status: "pending" }),
      ]; // 1/4 = 25% < 80%

      const result = assessReleaseReadiness(transactions);

      expect(result.ready).toBe(false);
      expect(result.blockers.some((b) => b.includes("25.0%"))).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should allow empty period when not required", () => {
      const result = assessReleaseReadiness([], { requireNonEmpty: false });

      expect(result.ready).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it("should respect custom settlement threshold", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "pending" }),
      ]; // 50% settled

      const result = assessReleaseReadiness(transactions, {
        minSettledPercentage: 40,
      });

      expect(result.ready).toBe(true);
    });

    it("should warn on high cancellation rate", () => {
      const transactions = [
        createMockTransaction({ status: "verified" }),
        createMockTransaction({ status: "cancelled" }),
        createMockTransaction({ status: "cancelled" }),
        createMockTransaction({ status: "cancelled" }),
      ]; // 75% cancelled

      const result = assessReleaseReadiness(transactions);

      expect(result.warnings.some((w) => w.includes("cancellation"))).toBe(
        true
      );
    });

    it("should warn when transactions locked but none settled", () => {
      const transactions = [
        createMockTransaction({ status: "pending", approvalStatus: "approved" }),
        createMockTransaction({ status: "pending", approvalStatus: "approved" }),
      ];

      const result = assessReleaseReadiness(transactions);

      expect(result.warnings.some((w) => w.includes("locked"))).toBe(true);
    });
  });
});

describe("formatReadinessReport", () => {
  it("should format ready result with metrics", () => {
    const result: ReleaseReadinessResult = {
      ready: true,
      blockers: [],
      warnings: [],
      metrics: {
        totalTransactions: 5,
        settledCount: 5,
        draftCount: 0,
        lockedCount: 0,
        cancelledCount: 0,
      },
    };

    const report = formatReadinessReport(result);

    expect(report).toContain("✓ READY");
    expect(report).toContain("Total: 5");
    expect(report).toContain("Settled: 5");
  });

  it("should format blocked result with blockers and warnings", () => {
    const result: ReleaseReadinessResult = {
      ready: false,
      blockers: ["2 draft transactions remain"],
      warnings: ["High cancellation rate: 30%"],
      metrics: {
        totalTransactions: 10,
        settledCount: 6,
        draftCount: 2,
        lockedCount: 1,
        cancelledCount: 3,
      },
    };

    const report = formatReadinessReport(result);

    expect(report).toContain("✗ NOT READY");
    expect(report).toContain("Blockers:");
    expect(report).toContain("✗ 2 draft transactions remain");
    expect(report).toContain("Warnings:");
    expect(report).toContain("⚠ High cancellation rate: 30%");
  });
});

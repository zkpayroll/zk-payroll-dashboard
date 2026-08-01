import { describe, it, expect } from "vitest";
import {
  synthesizeReconciliation,
  buildReconciliationDiff,
} from "@/lib/reconciliation/mockObserved";
import { generateReconciliationDiff } from "@/lib/reconciliation/ReconciliationDiffGenerator";
import type { Employee, PayrollRun } from "@/types/models";

const NOW = 1_700_000_000_000;

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: overrides.id ?? "emp_test",
    address: overrides.address ?? "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    name: overrides.name ?? "Test Employee",
    salary: overrides.salary ?? 5000,
    salaryCommitment: overrides.salaryCommitment ?? "0xcommit",
    isActive: overrides.isActive ?? true,
    status: overrides.status ?? "active",
    onboardingStatus: overrides.onboardingStatus ?? "completed",
    startDate: overrides.startDate ?? "2024-01-01T00:00:00Z",
  };
}

function run(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: overrides.id ?? "tx_test",
    companyId: overrides.companyId ?? "company_001",
    timestamp: overrides.timestamp ?? "2025-02-28T09:00:00Z",
    createdAt: overrides.createdAt ?? "2025-02-28T09:00:00Z",
    totalAmount: overrides.totalAmount ?? 10000,
    employeeCount: overrides.employeeCount ?? 2,
    proof: overrides.proof ?? "0xproof",
    status: overrides.status ?? "verified",
    txHash: overrides.txHash ?? "0xabc",
    isArchived: overrides.isArchived ?? false,
    employeeIds: overrides.employeeIds ?? ["emp_a", "emp_b"],
    executedAt: overrides.executedAt ?? "2025-02-28T09:00:00Z",
    transactionHash: overrides.transactionHash ?? "0xabc",
  };
}

describe("synthesizeReconciliation", () => {
  it("converts dollar salaries to bigint stroops", () => {
    const { expected } = synthesizeReconciliation(
      run(),
      [employee({ salary: 5000 })],
      NOW,
    );
    expect(expected.results[0]!.amount).toBe(BigInt(50_000_000_000));
  });

  it("classifies verified runs as success / observed-confirmed → all match", () => {
    const { expected, observed } = synthesizeReconciliation(
      run({ status: "verified" }),
      [employee({ id: "a", address: "GAAAA" }), employee({ id: "b", address: "GBBBB" })],
      NOW,
    );
    const result = generateReconciliationDiff(expected, observed);
    expect(result.counts.match).toBe(2);
    expect(result.isFullyReconciled).toBe(true);
  });

  it("classifies failed runs: first employee confirmed (mismatch), rest not_found (missing)", () => {
    const a = employee({ id: "a", address: "GAAAA" });
    const b = employee({ id: "b", address: "GBBBB" });
    const c = employee({ id: "c", address: "GCCCC" });
    const diff = buildReconciliationDiff(run({ status: "failed" }), [a, b, c], NOW);
    expect(diff.counts.failed_mismatch).toBe(1);
    expect(diff.counts.missing).toBe(2);
    expect(diff.isFullyReconciled).toBe(false);
  });

  it("classifies pending runs as pending / not_found → all still_pending", () => {
    const a = employee({ id: "a", address: "GAAAA" });
    const b = employee({ id: "b", address: "GBBBB" });
    const diff = buildReconciliationDiff(run({ status: "pending" }), [a, b], NOW);
    expect(diff.counts.still_pending).toBe(2);
    expect(diff.counts.match).toBe(0);
    // pending runs aren't actionable yet, so isFullyReconciled stays true.
    expect(diff.isFullyReconciled).toBe(true);
  });

  it("classifies cancelled runs as still_pending (synthesis maps cancelled → pending)", () => {
    const a = employee({ id: "a", address: "GAAAA" });
    const diff = buildReconciliationDiff(run({ status: "cancelled" }), [a], NOW);
    expect(diff.counts.still_pending).toBe(1);
  });

  it("preserves the run's transactionHash on expected outcomes", () => {
    const { expected } = synthesizeReconciliation(
      run({ transactionHash: "0xspecial" }),
      [employee()],
      NOW,
    );
    expect(expected.results[0]!.txHash).toBe("0xspecial");
  });
});
import { describe, it, expect } from "vitest";
import {
  buildDiscrepancyInspectorData,
  filterDiscrepancyGroups,
  countTotalDiscrepancies,
  isDiscrepancyCategory,
} from "@/lib/reconciliation/discrepancyInspector";
import type { Employee, PayrollRun } from "@/types/models";

const NOW = 1_700_000_000_000;

const employees: Employee[] = [
  {
    id: "emp_a",
    address: "GADDRESSA",
    name: "Employee A",
    salary: 100,
    salaryCommitment: "0x1",
    isActive: true,
    onboardingStatus: "completed",
    startDate: "2024-01-01T00:00:00Z",
  },
  {
    id: "emp_b",
    address: "GADDRESSB",
    name: "Employee B",
    salary: 200,
    salaryCommitment: "0x2",
    isActive: true,
    onboardingStatus: "completed",
    startDate: "2024-01-01T00:00:00Z",
  },
];

function makeRun(overrides: Partial<PayrollRun>): PayrollRun {
  return {
    id: "run_1",
    companyId: "company_001",
    timestamp: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    totalAmount: 300,
    employeeCount: 2,
    proof: "proof",
    status: "verified",
    employeeIds: ["emp_a", "emp_b"],
    ...overrides,
  };
}

describe("isDiscrepancyCategory", () => {
  it("treats match and still_pending as non-discrepancies", () => {
    expect(isDiscrepancyCategory("match")).toBe(false);
    expect(isDiscrepancyCategory("still_pending")).toBe(false);
  });

  it("treats missing/failed_mismatch/amount_mismatch/unexpected as discrepancies", () => {
    expect(isDiscrepancyCategory("missing")).toBe(true);
    expect(isDiscrepancyCategory("failed_mismatch")).toBe(true);
    expect(isDiscrepancyCategory("amount_mismatch")).toBe(true);
    expect(isDiscrepancyCategory("unexpected")).toBe(true);
  });
});

describe("buildDiscrepancyInspectorData", () => {
  it("omits runs with no discrepancies (verified run: all match)", () => {
    const groups = buildDiscrepancyInspectorData([makeRun({ status: "verified" })], employees, NOW);
    expect(groups).toHaveLength(0);
  });

  it("surfaces discrepancies for a failed run (status mismatch + missing)", () => {
    const groups = buildDiscrepancyInspectorData([makeRun({ status: "failed" })], employees, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].run.id).toBe("run_1");
    expect(groups[0].discrepancies.length).toBeGreaterThan(0);
    expect(groups[0].discrepancies.every((e) => isDiscrepancyCategory(e.category))).toBe(true);
  });

  it("aggregates discrepancies across multiple runs", () => {
    const groups = buildDiscrepancyInspectorData(
      [makeRun({ id: "run_1", status: "failed" }), makeRun({ id: "run_2", status: "verified" })],
      employees,
      NOW,
    );
    expect(groups.map((g) => g.run.id)).toEqual(["run_1"]);
  });
});

describe("filterDiscrepancyGroups", () => {
  const groups = buildDiscrepancyInspectorData([makeRun({ status: "failed" })], employees, NOW);

  it("filters by category", () => {
    const filtered = filterDiscrepancyGroups(groups, { categories: ["failed_mismatch"] });
    expect(filtered.every((g) => g.discrepancies.every((e) => e.category === "failed_mismatch"))).toBe(
      true,
    );
  });

  it("filters by search term matching run id", () => {
    const filtered = filterDiscrepancyGroups(groups, { search: "run_1" });
    expect(filtered).toHaveLength(1);
  });

  it("filters by search term matching recipient", () => {
    const filtered = filterDiscrepancyGroups(groups, { search: "gaddressb" });
    expect(filtered[0]?.discrepancies.every((e) => e.recipient === "GADDRESSB")).toBe(true);
  });

  it("returns nothing when search matches neither run id nor recipients", () => {
    const filtered = filterDiscrepancyGroups(groups, { search: "no-match-at-all" });
    expect(filtered).toHaveLength(0);
  });
});

describe("countTotalDiscrepancies", () => {
  it("sums discrepancies across groups", () => {
    const groups = buildDiscrepancyInspectorData([makeRun({ status: "failed" })], employees, NOW);
    const total = countTotalDiscrepancies(groups);
    expect(total).toBe(groups.reduce((sum, g) => sum + g.discrepancies.length, 0));
    expect(total).toBeGreaterThan(0);
  });
});

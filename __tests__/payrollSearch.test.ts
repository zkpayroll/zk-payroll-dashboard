import { describe, it, expect } from "vitest";
import {
  matchesPayrollSearch,
  searchPayrollRuns,
  formatRunPeriod,
  resolveEmployerSearchContext,
} from "@/lib/payrollSearch";
import type { Company, PayrollTransaction } from "@/types/models";

/** Issue #167, Issue #845 — payroll run search with employer context. */

const mockCompanyRegistry: Company[] = [
  {
    id: "co-1",
    name: "Acme Payroll Labs",
    admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    employeeCount: 5,
    isActive: true,
  },
  {
    id: "co-2",
    name: "Stellar Horizon Ltd",
    admin: "GBVXCPHJMZ5HZJMBBP3YMBM6HXKH3JRXJBHXJHXJHXJHXJHXJHXJHX",
    treasury: "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2",
    employeeCount: 12,
    isActive: true,
  },
];

const base: PayrollTransaction = {
  id: "run-2026-03-001",
  companyId: "co-1",
  timestamp: "2026-03-15T10:00:00.000Z",
  createdAt: "2026-03-15T10:00:00.000Z",
  totalAmount: 1000,
  employeeCount: 5,
  proof: "proof-abc",
  status: "verified",
  txHash: "0xdeadbeef1234",
};

const runs: PayrollTransaction[] = [
  base,
  {
    ...base,
    id: "run-2026-04-002",
    companyId: "co-2",
    createdAt: "2026-04-10T10:00:00.000Z",
    timestamp: "2026-04-10T10:00:00.000Z",
    status: "failed",
    txHash: "0xfeedface5678",
  },
];

describe("matchesPayrollSearch", () => {
  it("matches on run id", () => {
    expect(matchesPayrollSearch(base, "2026-03-001")).toBe(true);
  });

  it("matches on transaction hash", () => {
    expect(matchesPayrollSearch(base, "deadbeef")).toBe(true);
  });

  it("matches on the visible reconciliation status", () => {
    const mismatched = { ...base, reconciliationStatus: "mismatched" as const };
    expect(matchesPayrollSearch(mismatched, "mismatched")).toBe(true);
    expect(matchesPayrollSearch(mismatched, "manually reviewed")).toBe(false);
  });

  it("matches on status", () => {
    expect(matchesPayrollSearch(base, "verified")).toBe(true);
    expect(matchesPayrollSearch(base, "failed")).toBe(false);
  });

  it("matches on the human-readable period", () => {
    expect(matchesPayrollSearch(base, "March 2026")).toBe(true);
  });

  it("also matches the ISO date, since users paste both forms", () => {
    expect(matchesPayrollSearch(base, "2026-03-15")).toBe(true);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(matchesPayrollSearch(base, "  MARCH 2026  ")).toBe(true);
    expect(matchesPayrollSearch(base, "0XDEADBEEF")).toBe(true);
  });

  it("matches on employer context (companyId and employer name) - Issue #845", () => {
    // Match by companyId
    expect(matchesPayrollSearch(base, "co-1", mockCompanyRegistry)).toBe(true);
    expect(matchesPayrollSearch(base, "CO-1", mockCompanyRegistry)).toBe(true);

    // Match by employer name
    expect(matchesPayrollSearch(base, "Acme", mockCompanyRegistry)).toBe(true);
    expect(matchesPayrollSearch(base, "acme payroll", mockCompanyRegistry)).toBe(true);
    expect(matchesPayrollSearch(base, "LABS", mockCompanyRegistry)).toBe(true);

    // Matches with options object as well
    expect(
      matchesPayrollSearch(base, "Acme", { companies: mockCompanyRegistry }),
    ).toBe(true);

    // Non-matching company
    expect(matchesPayrollSearch(base, "Horizon", mockCompanyRegistry)).toBe(false);
  });

  it("matches default mock companies when custom registry is not provided", () => {
    const defaultRun: PayrollTransaction = {
      ...base,
      companyId: "company_001",
    };
    // MOCK_COMPANIES has "company_001" with name "ZK Payroll Inc."
    expect(matchesPayrollSearch(defaultRun, "company_001")).toBe(true);
    expect(matchesPayrollSearch(defaultRun, "ZK Payroll")).toBe(true);
    expect(matchesPayrollSearch(defaultRun, "zk payroll inc")).toBe(true);
  });

  it("protects private data: rejects proof secrets, employee names, and salary numbers", () => {
    // ZK proof secrets must never match
    expect(matchesPayrollSearch(base, "proof-abc")).toBe(false);

    // Salary amounts must not match
    expect(matchesPayrollSearch(base, "1000")).toBe(false);

    // Employee names or IDs should not match via payrollSearch
    expect(matchesPayrollSearch(base, "emp_001")).toBe(false);
    expect(matchesPayrollSearch(base, "Alice Mensah")).toBe(false);
  });

  it("handles boundary cases: missing companyId, whitespace companyId, or unresolvable companyId", () => {
    const noCompany: PayrollTransaction = {
      ...base,
      companyId: "",
    };
    expect(matchesPayrollSearch(noCompany, "co-1")).toBe(false);
    expect(matchesPayrollSearch(noCompany, "run-2026")).toBe(true);

    const undefinedCompany: PayrollTransaction = {
      ...base,
      companyId: undefined as any,
    };
    expect(matchesPayrollSearch(undefinedCompany, "co-1")).toBe(false);
    expect(matchesPayrollSearch(undefinedCompany, "run-2026")).toBe(true);

    const unknownCompany: PayrollTransaction = {
      ...base,
      companyId: "comp_unknown_999",
    };
    // Company ID matches directly even if unresolvable in registry
    expect(matchesPayrollSearch(unknownCompany, "comp_unknown_999", mockCompanyRegistry)).toBe(true);
    // But unregistered name does not match
    expect(matchesPayrollSearch(unknownCompany, "Nonexistent Corp", mockCompanyRegistry)).toBe(false);
  });

  it("treats an empty or whitespace query as matching everything", () => {
    // Clearing the box must restore the list, not empty it.
    expect(matchesPayrollSearch(base, "")).toBe(true);
    expect(matchesPayrollSearch(base, "   ")).toBe(true);
  });

  it("tolerates a missing transaction hash", () => {
    const { txHash: _omit, ...withoutHash } = base;
    expect(matchesPayrollSearch(withoutHash as PayrollTransaction, "run-2026")).toBe(true);
  });
});

describe("searchPayrollRuns", () => {
  it("returns the original list for an empty query", () => {
    expect(searchPayrollRuns(runs, "")).toHaveLength(2);
  });

  it("narrows to matching runs by transaction details or employer context", () => {
    expect(searchPayrollRuns(runs, "feedface").map((r) => r.id)).toEqual(["run-2026-04-002"]);
    expect(searchPayrollRuns(runs, "failed").map((r) => r.id)).toEqual(["run-2026-04-002"]);
    expect(
      searchPayrollRuns(runs, "Stellar Horizon", mockCompanyRegistry).map((r) => r.id),
    ).toEqual(["run-2026-04-002"]);
    expect(
      searchPayrollRuns(runs, "co-1", mockCompanyRegistry).map((r) => r.id),
    ).toEqual(["run-2026-03-001"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchPayrollRuns(runs, "nonexistent")).toHaveLength(0);
  });
});

describe("resolveEmployerSearchContext", () => {
  it("resolves companyId and employerName from registry", () => {
    const ctx = resolveEmployerSearchContext({ companyId: "co-1" }, mockCompanyRegistry);
    expect(ctx).toEqual({
      companyId: "co-1",
      employerName: "Acme Payroll Labs",
    });
  });

  it("returns empty values when companyId is blank or undefined", () => {
    expect(resolveEmployerSearchContext({ companyId: "" })).toEqual({
      companyId: "",
      employerName: "",
    });
    expect(resolveEmployerSearchContext({ companyId: undefined as any })).toEqual({
      companyId: "",
      employerName: "",
    });
  });

  it("returns companyId with empty employerName when company not found in registry", () => {
    expect(
      resolveEmployerSearchContext({ companyId: "unknown-co" }, mockCompanyRegistry),
    ).toEqual({
      companyId: "unknown-co",
      employerName: "",
    });
  });
});

describe("formatRunPeriod", () => {
  it("formats the period from createdAt", () => {
    expect(formatRunPeriod(base)).toBe("March 2026");
  });

  it("returns an empty string for an unparseable date rather than 'Invalid Date'", () => {
    expect(formatRunPeriod({ createdAt: "nope", timestamp: "nope" })).toBe("");
  });
});

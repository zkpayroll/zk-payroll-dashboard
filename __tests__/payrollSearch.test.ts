import { describe, it, expect } from "vitest";
import {
  matchesPayrollSearch,
  searchPayrollRuns,
  formatRunPeriod,
} from "@/lib/payrollSearch";
import type { PayrollTransaction } from "@/types/models";

/** Issue #167 — payroll run search. */

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
  { ...base, id: "run-2026-04-002", createdAt: "2026-04-10T10:00:00.000Z", timestamp: "2026-04-10T10:00:00.000Z", status: "failed", txHash: "0xfeedface5678" },
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

  it("does not match fields the table never displays", () => {
    // Matching on `proof` would return rows the user cannot explain.
    expect(matchesPayrollSearch(base, "proof-abc")).toBe(false);
    expect(matchesPayrollSearch(base, "co-1")).toBe(false);
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

  it("narrows to matching runs", () => {
    expect(searchPayrollRuns(runs, "feedface").map((r) => r.id)).toEqual(["run-2026-04-002"]);
    expect(searchPayrollRuns(runs, "failed").map((r) => r.id)).toEqual(["run-2026-04-002"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchPayrollRuns(runs, "nonexistent")).toHaveLength(0);
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

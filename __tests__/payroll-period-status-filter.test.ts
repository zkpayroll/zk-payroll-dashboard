import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERIOD_STATUS_FILTER,
  MOCK_PAYROLL_PERIODS,
  PAYROLL_PERIOD_STATUSES,
  PERIOD_STATUS_LABELS,
  countPeriodsByStatus,
  describePeriodFilterResult,
  filterPeriodsByStatus,
  isPayrollPeriodStatus,
  normalizePeriodStatusFilter,
} from "@/src/payroll/periodStatusFilter";
import type { PayrollPeriod, PeriodStatusCounts } from "@/src/payroll/periodStatusFilter";

function period(overrides: Partial<PayrollPeriod> = {}): PayrollPeriod {
  return {
    id: "2026-01",
    label: "January 2026",
    status: "draft",
    runCount: 1,
    ...overrides,
  };
}

describe("payroll period statuses", () => {
  it("exposes the four documented lifecycle statuses in order", () => {
    expect(PAYROLL_PERIOD_STATUSES).toEqual([
      "draft",
      "active",
      "finalized",
      "archived",
    ]);
  });

  it("labels every status for display", () => {
    expect(PERIOD_STATUS_LABELS).toEqual({
      draft: "Draft",
      active: "Active",
      finalized: "Finalized",
      archived: "Archived",
    });
  });
});

describe("isPayrollPeriodStatus", () => {
  it("accepts only known statuses", () => {
    for (const status of PAYROLL_PERIOD_STATUSES) {
      expect(isPayrollPeriodStatus(status)).toBe(true);
    }
  });

  it("rejects unknown or non-string values", () => {
    expect(isPayrollPeriodStatus("all")).toBe(false);
    expect(isPayrollPeriodStatus("FINALIZED")).toBe(false);
    expect(isPayrollPeriodStatus("")).toBe(false);
    expect(isPayrollPeriodStatus(undefined)).toBe(false);
    expect(isPayrollPeriodStatus(null)).toBe(false);
    expect(isPayrollPeriodStatus(42)).toBe(false);
  });
});

describe("normalizePeriodStatusFilter", () => {
  it("keeps a recognised status or 'all'", () => {
    expect(normalizePeriodStatusFilter("all")).toBe("all");
    expect(normalizePeriodStatusFilter("finalized")).toBe("finalized");
  });

  it("falls back to 'all' for untrusted input instead of throwing", () => {
    expect(normalizePeriodStatusFilter("bogus")).toBe(
      DEFAULT_PERIOD_STATUS_FILTER,
    );
    expect(normalizePeriodStatusFilter("FINALIZED")).toBe("all");
    expect(normalizePeriodStatusFilter(undefined)).toBe("all");
    expect(normalizePeriodStatusFilter(null)).toBe("all");
    expect(normalizePeriodStatusFilter(123)).toBe("all");
  });
});

describe("countPeriodsByStatus", () => {
  it("counts each status plus the total", () => {
    expect(countPeriodsByStatus(MOCK_PAYROLL_PERIODS)).toEqual({
      all: 5,
      draft: 1,
      active: 1,
      finalized: 2,
      archived: 1,
    });
  });

  it("counts an empty list as all zeroes", () => {
    expect(countPeriodsByStatus([])).toEqual({
      all: 0,
      draft: 0,
      active: 0,
      finalized: 0,
      archived: 0,
    });
  });

  it("ignores periods whose status is not recognised, but still counts them in the total", () => {
    const counts = countPeriodsByStatus([
      period({ status: "draft" }),
      { ...period({ id: "ghost" }), status: "bogus" as never },
    ]);
    expect(counts.all).toBe(2);
    expect(counts.draft).toBe(1);
    expect(counts.archived).toBe(0);
  });
});

describe("filterPeriodsByStatus", () => {
  it("returns a copy of every period when unfiltered", () => {
    const result = filterPeriodsByStatus(MOCK_PAYROLL_PERIODS, "all");
    expect(result).toEqual(MOCK_PAYROLL_PERIODS);
    expect(result).not.toBe(MOCK_PAYROLL_PERIODS);
  });

  it("narrows to a single status", () => {
    const result = filterPeriodsByStatus(MOCK_PAYROLL_PERIODS, "finalized");
    expect(result.map((p) => p.id)).toEqual(["2026-07", "2026-05"]);
  });

  it("does not mutate the source list", () => {
    const source = [...MOCK_PAYROLL_PERIODS];
    filterPeriodsByStatus(source, "archived");
    expect(source).toEqual(MOCK_PAYROLL_PERIODS);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterPeriodsByStatus([period({ status: "draft" })], "archived")).toEqual(
      [],
    );
  });
});

describe("describePeriodFilterResult", () => {
  const counts: PeriodStatusCounts = {
    all: 5,
    draft: 1,
    active: 1,
    finalized: 2,
    archived: 1,
  };

  it("describes the unfiltered list", () => {
    expect(describePeriodFilterResult(counts, "all", 5)).toBe(
      "All 5 periods listed",
    );
  });

  it("describes a filtered list with counts only", () => {
    expect(describePeriodFilterResult(counts, "finalized", 2)).toBe(
      "2 finalized periods — 2 of 5",
    );
  });

  it("uses singular wording for a single match", () => {
    const single: PeriodStatusCounts = {
      all: 1,
      draft: 0,
      active: 0,
      finalized: 1,
      archived: 0,
    };
    expect(describePeriodFilterResult(single, "finalized", 1)).toBe(
      "1 finalized period — 1 of 1",
    );
  });
});

describe("privacy", () => {
  it("never carries amounts, salaries, wallets, or proofs in the fixture", () => {
    const serialized = JSON.stringify(MOCK_PAYROLL_PERIODS);
    expect(serialized).not.toMatch(/\$\d|salary|wallet|proof|secret/i);
  });
});

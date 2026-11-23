import { describe, it, expect } from "vitest";
import {
  EMPTY_QUICK_FILTERS,
  applyQuickFilters,
  computeQuickFilterCounts,
  countActiveQuickFilters,
  deriveHistoryRiskLevel,
  deriveTreasuryFacet,
  getRunQuickFacets,
  isQuickFilterEmpty,
  runMatchesQuickFilters,
  toggleQuickFilter,
} from "@/src/payroll/quickFilters";
import type { QuickFilterableRun } from "@/src/payroll/quickFilters";
import type { QuickFilterSelection } from "@/src/payroll/quickFilters";

function run(overrides: Partial<QuickFilterableRun> = {}): QuickFilterableRun {
  return {
    id: "tx_test",
    companyId: "company_001",
    timestamp: "2025-02-28T09:01:00Z",
    createdAt: "2025-02-28T09:01:00Z",
    totalAmount: 1000,
    employeeCount: 1,
    proof: "",
    status: "verified",
    isArchived: false,
    ...overrides,
  };
}

const RUNS: QuickFilterableRun[] = [
  // verified + approved + reconciled complete
  run({
    id: "tx_001",
    approvalStatus: "approved",
    reconciliationStatus: "complete",
  }),
  // pending + awaiting approval + reconciliation pending
  run({
    id: "tx_003",
    status: "pending",
    approvalStatus: "pending_executive_approval",
    reconciliationStatus: "pending",
  }),
  // cancelled for insufficient treasury → risk block / treasury underfunded
  run({
    id: "tx_010",
    status: "cancelled",
    approvalStatus: "rejected",
    cancellationReason: "treasury_insufficient",
  }),
];

describe("deriveHistoryRiskLevel", () => {
  it("classifies failed and underfunded runs as block", () => {
    expect(deriveHistoryRiskLevel(run({ status: "failed" }))).toBe("block");
    expect(
      deriveHistoryRiskLevel(
        run({ cancellationReason: "treasury_insufficient" }),
      ),
    ).toBe("block");
    expect(
      deriveHistoryRiskLevel(run({ reconciliationStatus: "failed" })),
    ).toBe("block");
  });

  it("gives blocking signals precedence over approval pushback", () => {
    // Rejected AND underfunded → the more severe signal wins.
    expect(
      deriveHistoryRiskLevel(
        run({
          status: "cancelled",
          approvalStatus: "rejected",
          cancellationReason: "treasury_insufficient",
        }),
      ),
    ).toBe("block");
  });

  it("classifies rejected or correction-requested runs as warning", () => {
    expect(deriveHistoryRiskLevel(run({ approvalStatus: "rejected" }))).toBe(
      "warning",
    );
    expect(
      deriveHistoryRiskLevel(run({ approvalStatus: "correction_requested" })),
    ).toBe("warning");
  });

  it("classifies unverified in-flight runs as caution", () => {
    expect(deriveHistoryRiskLevel(run({ status: "pending" }))).toBe("caution");
  });

  it("classifies settled runs with no adverse state as clear", () => {
    expect(deriveHistoryRiskLevel(run())).toBe("clear");
  });
});

describe("deriveTreasuryFacet", () => {
  it("reports only what the run state actually proves", () => {
    expect(
      deriveTreasuryFacet(run({ cancellationReason: "treasury_insufficient" })),
    ).toBe("underfunded");
    expect(deriveTreasuryFacet(run({ status: "verified" }))).toBe("funded");
  });

  it("never guesses — unknown state is unverified, not underfunded", () => {
    expect(deriveTreasuryFacet(run({ status: "pending" }))).toBe("unverified");
    expect(deriveTreasuryFacet(run({ status: "failed" }))).toBe("unverified");
    expect(
      deriveTreasuryFacet(run({ status: "cancelled", cancellationReason: "manual_request" })),
    ).toBe("unverified");
  });
});

describe("toggleQuickFilter", () => {
  it("selects a facet within a group", () => {
    const next = toggleQuickFilter(EMPTY_QUICK_FILTERS, "status", "pending");
    expect(next.status).toBe("pending");
    expect(isQuickFilterEmpty(next)).toBe(false);
  });

  it("re-selecting the active facet resets the group to all", () => {
    const selected = toggleQuickFilter(EMPTY_QUICK_FILTERS, "status", "pending");
    const toggledOff = toggleQuickFilter(selected, "status", "pending");
    expect(toggledOff.status).toBe("all");
    expect(isQuickFilterEmpty(toggledOff)).toBe(true);
  });

  it("does not mutate the previous selection", () => {
    const before = { ...EMPTY_QUICK_FILTERS };
    toggleQuickFilter(EMPTY_QUICK_FILTERS, "risk", "block");
    expect(EMPTY_QUICK_FILTERS).toEqual(before);
  });

  it("keeps other groups untouched when switching values in one group", () => {
    const withStatus = toggleQuickFilter(EMPTY_QUICK_FILTERS, "status", "failed");
    const both = toggleQuickFilter(withStatus, "treasury", "funded");
    expect(both.status).toBe("failed");
    expect(both.treasury).toBe("funded");
    expect(countActiveQuickFilters(both)).toBe(2);
  });
});

describe("runMatchesQuickFilters", () => {
  it("matches everything when no quick filter is active", () => {
    expect(runMatchesQuickFilters(getRunQuickFacets(run()), EMPTY_QUICK_FILTERS)).toBe(
      true,
    );
  });

  it("excludes runs whose facet differs from the selection", () => {
    const selection: QuickFilterSelection = {
      ...EMPTY_QUICK_FILTERS,
      status: "failed",
    };
    expect(runMatchesQuickFilters(getRunQuickFacets(run()), selection)).toBe(false);
  });

  it("excludes runs missing the facet instead of guessing a match", () => {
    const selection: QuickFilterSelection = {
      ...EMPTY_QUICK_FILTERS,
      approval: "approved",
      reconciliation: "complete",
    };
    // Plain transaction: no approvalStatus, no reconciliationStatus.
    expect(runMatchesQuickFilters(getRunQuickFacets(run()), selection)).toBe(
      false,
    );
  });
});

describe("applyQuickFilters", () => {
  it("returns the same list untouched when nothing is selected", () => {
    expect(applyQuickFilters(RUNS, EMPTY_QUICK_FILTERS)).toBe(RUNS);
  });

  it("narrows by a single facet", () => {
    const result = applyQuickFilters(RUNS, {
      ...EMPTY_QUICK_FILTERS,
      status: "pending",
    });
    expect(result.map((r) => r.id)).toEqual(["tx_003"]);
  });

  it("intersects multiple groups", () => {
    const result = applyQuickFilters(RUNS, {
      ...EMPTY_QUICK_FILTERS,
      status: "cancelled",
      treasury: "funded", // contradicts the cancelled run → nothing matches
    });
    expect(result).toEqual([]);
  });

  it("matches derived facets (risk) even though rows never store them", () => {
    const result = applyQuickFilters(RUNS, {
      ...EMPTY_QUICK_FILTERS,
      risk: "block",
    });
    expect(result.map((r) => r.id)).toEqual(["tx_010"]);
  });
});

describe("computeQuickFilterCounts", () => {
  it("counts each facet of the pool when nothing is selected", () => {
    const counts = computeQuickFilterCounts(RUNS, EMPTY_QUICK_FILTERS);
    expect(counts.status.verified).toBe(1);
    expect(counts.status.pending).toBe(1);
    expect(counts.status.cancelled).toBe(1);
    expect(counts.treasury.underfunded).toBe(1);
    expect(counts.treasury.unverified).toBe(1);
    expect(counts.approval.approved).toBe(1);
    expect(counts.reconciliation.complete).toBe(1);
  });

  it("ignores a group's own selection but respects the others", () => {
    const counts = computeQuickFilterCounts(RUNS, {
      ...EMPTY_QUICK_FILTERS,
      status: "pending",
    });
    // Reconciliation counts are computed among runs matching status=pending.
    expect(counts.reconciliation.pending).toBe(1);
    expect(counts.reconciliation.complete).toBeUndefined();
    // …and status counts still describe the whole pool for each value.
    expect(counts.status.verified).toBe(1);
  });

  it("omits facets no run exposes", () => {
    const counts = computeQuickFilterCounts(RUNS, EMPTY_QUICK_FILTERS);
    expect(counts.approval.draft).toBeUndefined();
    expect(counts.reconciliation.failed).toBeUndefined();
  });
});

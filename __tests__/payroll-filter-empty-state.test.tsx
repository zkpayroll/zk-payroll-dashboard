import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PayrollFilterEmptyState from "@/components/filters/PayrollFilterEmptyState";
import {
  MAX_SEARCH_ECHO_LENGTH,
  describePayrollEmptyState,
  formatSearchEcho,
  humanizeFilterValue,
  quickFilterConstraints,
} from "@/src/payroll/emptyState";
import { EMPTY_QUICK_FILTERS } from "@/src/payroll/quickFilters";

const STATUS_FAILED = { key: "status", label: "Status: Failed" };

describe("describePayrollEmptyState (#464)", () => {
  it("reports no-data when the pool is empty, even with filters set", () => {
    const result = describePayrollEmptyState({
      poolSize: 0,
      search: "abc",
      filters: [STATUS_FAILED],
    });
    expect(result.reason).toBe("no-data");
    expect(result.title).toBe("No payroll runs yet");
  });

  it("reports no-data when nothing is constraining the list", () => {
    const result = describePayrollEmptyState({
      poolSize: 5,
      search: "   ",
      filters: [],
    });
    expect(result.reason).toBe("no-data");
    expect(result.constraints).toEqual([]);
  });

  it("explains a search-only miss and echoes the query", () => {
    const result = describePayrollEmptyState({
      poolSize: 4,
      search: "  zzz ",
      filters: [],
    });
    expect(result.reason).toBe("search");
    expect(result.title).toBe("No payroll runs match your search");
    expect(result.description).toContain("0 of 4 payroll runs");
    expect(result.description).toContain('"zzz"');
    expect(result.constraints).toEqual([{ key: "search", label: 'Search: "zzz"' }]);
  });

  it("explains a filter-only miss with the filter count", () => {
    const result = describePayrollEmptyState({
      poolSize: 3,
      search: "",
      filters: [STATUS_FAILED, { key: "dateFrom", label: "From: 2026-01-01" }],
      noun: "transactions",
    });
    expect(result.reason).toBe("filters");
    expect(result.title).toBe("No transactions match the current filters");
    expect(result.description).toContain("2 active filters");
  });

  it("lists search first when search and filters combine", () => {
    const result = describePayrollEmptyState({
      poolSize: 3,
      search: "run",
      filters: [STATUS_FAILED],
    });
    expect(result.reason).toBe("search-and-filters");
    expect(result.constraints.map((c) => c.key)).toEqual(["search", "status"]);
    expect(result.description).toContain("1 active filter.");
  });

  it("truncates long search echoes so pasted identifiers are not shown in full", () => {
    const longHash = "a".repeat(64);
    const echo = formatSearchEcho(longHash);
    expect(echo).toHaveLength(MAX_SEARCH_ECHO_LENGTH);
    expect(echo.endsWith("…")).toBe(true);
    const result = describePayrollEmptyState({
      poolSize: 2,
      search: longHash,
      filters: [],
    });
    expect(result.description).not.toContain(longHash);
  });
});

describe("quickFilterConstraints (#464)", () => {
  it("returns nothing when no quick filter is active", () => {
    expect(quickFilterConstraints({ ...EMPTY_QUICK_FILTERS })).toEqual([]);
  });

  it("labels active quick filters in toolbar order", () => {
    expect(
      quickFilterConstraints({
        ...EMPTY_QUICK_FILTERS,
        reconciliation: "partial",
        approval: "pending_executive_approval",
      }),
    ).toEqual([
      { key: "quick:approval", label: "Approval: Pending executive approval" },
      { key: "quick:reconciliation", label: "Reconciliation: Partial" },
    ]);
  });

  it("humanizes snake_case values", () => {
    expect(humanizeFilterValue("manually_reviewed")).toBe("Manually reviewed");
  });
});

describe("<PayrollFilterEmptyState /> (#464)", () => {
  it("shows why the list is empty and removes a single constraint", () => {
    const onRemoveFilter = vi.fn();
    render(
      <PayrollFilterEmptyState
        poolSize={6}
        search="march"
        filters={[STATUS_FAILED]}
        onRemoveFilter={onRemoveFilter}
        onClearAll={() => {}}
      />,
    );

    expect(screen.getByTestId("payroll-filter-empty-state")).toHaveAttribute(
      "data-empty-reason",
      "search-and-filters",
    );
    expect(
      screen.getByText("No payroll runs match your search and filters"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Status: Failed" }));
    expect(onRemoveFilter).toHaveBeenCalledWith("status");

    fireEvent.click(screen.getByRole("button", { name: 'Remove Search: "march"' }));
    expect(onRemoveFilter).toHaveBeenCalledWith("search");
  });

  it("resets everything from the clear-all action", () => {
    const onClearAll = vi.fn();
    render(
      <PayrollFilterEmptyState
        poolSize={6}
        search=""
        filters={[STATUS_FAILED]}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    // No per-chip remove buttons without a handler.
    expect(screen.queryByRole("button", { name: /^remove/i })).toBeNull();
  });

  it("renders a plain no-data state without reset controls", () => {
    render(
      <PayrollFilterEmptyState
        poolSize={0}
        search=""
        filters={[]}
        noDataDescription="No archived payroll runs found."
        onClearAll={() => {}}
      />,
    );
    expect(screen.getByText("No archived payroll runs found.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear all filters/i })).toBeNull();
  });

  it("never renders currency amounts in its copy", () => {
    const { container } = render(
      <PayrollFilterEmptyState
        poolSize={12}
        search="tx_"
        filters={[STATUS_FAILED]}
        onClearAll={() => {}}
      />,
    );
    expect(container.textContent).not.toMatch(/\$\s?\d/);
  });
});

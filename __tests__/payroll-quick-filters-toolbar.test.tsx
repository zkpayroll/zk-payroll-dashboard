import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import PayrollQuickFilters, {
  type PayrollQuickFiltersProps,
} from "@/components/filters/PayrollQuickFilters";
import {
  EMPTY_QUICK_FILTERS,
  computeQuickFilterCounts,
} from "@/src/payroll/quickFilters";
import type { QuickFilterSelection } from "@/src/payroll/quickFilters";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";

describe("<PayrollQuickFilters /> (unit)", () => {
  function Toolbar(props: Partial<PayrollQuickFiltersProps> = {}) {
    const selection: QuickFilterSelection = { ...EMPTY_QUICK_FILTERS };
    const runs = MOCK_TRANSACTIONS.filter((t) => !t.isArchived);
    const utils = {
      selection,
      counts: computeQuickFilterCounts(runs, selection),
      totalCount: runs.length,
      filteredCount: runs.length,
      onChange: (next: QuickFilterSelection) => {
        utils.selection = next;
      },
      ...props,
    };
    return <PayrollQuickFilters {...utils} />;
  }

  it("renders one fieldset per quick-filter group", () => {
    render(Toolbar());
    expect(
      screen.getByRole("group", { name: "Filter by payroll status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filter by approval state" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filter by risk state" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filter by treasury readiness" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filter by reconciliation outcome" }),
    ).toBeInTheDocument();
  });

  it("announces all runs when nothing is selected", () => {
    render(Toolbar());
    expect(screen.getByRole("status")).toHaveTextContent(/All 3 runs listed/);
  });

  it("marks the active chip selected and announces the narrowed list", () => {
    const { rerender } = render(Toolbar());
    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    fireEvent.click(within(statusGroup).getByRole("checkbox", { name: /Pending/ }));

    rerender(
      Toolbar({
        selection: { ...EMPTY_QUICK_FILTERS, status: "pending" },
        filteredCount: 1,
      }),
    );

    expect(
      within(statusGroup).getByRole("checkbox", { name: /Pending/ }),
    ).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      /1 of 3 runs match 1 quick filter/,
    );
  });
});

describe("TransactionHistory quick filters integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows faceted counts matching the pool", () => {
    render(<TransactionHistory />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    // Non-archived pool: tx_001 verified, tx_003 pending, tx_004 cancelled.
    expect(within(statusGroup).getByRole("checkbox", { name: /Verified \(1/ })).toBeInTheDocument();
    expect(within(statusGroup).getByRole("checkbox", { name: /Pending \(1/ })).toBeInTheDocument();
    expect(within(statusGroup).getByRole("checkbox", { name: /Cancelled \(1/ })).toBeInTheDocument();
  });

  it("narrows the table when a quick filter chip is clicked", () => {
    render(<TransactionHistory />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    fireEvent.click(within(statusGroup).getByRole("checkbox", { name: /Pending/ }));

    expect(screen.getByText(/Showing 1 of 3 transactions/)).toBeInTheDocument();
  });

  it("adds quick filters to the header filter count alongside panel filters", () => {
    render(<TransactionHistory />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    fireEvent.click(within(statusGroup).getByRole("checkbox", { name: /Verified/ }));

    // One quick filter active → the bar reports 1.
    expect(screen.getByText(/1 filter active/)).toBeInTheDocument();

    // Adding a panel filter stacks the counts: 1 quick + 1 panel = 2.
    // (Match anchored so "Clear quick filters" does not also hit /filter/i.)
    fireEvent.click(screen.getByRole("button", { name: /^filters/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /^status$/i }), {
      target: { value: "pending" },
    });

    expect(screen.getByText(/2 filters active/)).toBeInTheDocument();
    const filterToggle = screen.getByRole("button", { name: /^filters/i });
    expect(within(filterToggle).getByText("2")).toBeInTheDocument();
    // Contradictory combination yields the actionable empty state.
    expect(screen.getByText(/Showing 0 of 3 transactions/)).toBeInTheDocument();
  });

  it("clears all quick filters from the toolbar", () => {
    render(<TransactionHistory />);

    const riskGroup = screen.getByRole("group", { name: "Filter by risk state" });
    fireEvent.click(within(riskGroup).getByRole("checkbox", { name: /Block/ }));
    expect(screen.getByText(/Showing 0 of 3 transactions/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear quick filters" }));
    expect(screen.getByText(/Showing 3 of 3 transactions/)).toBeInTheDocument();
  });

  it("shows an actionable empty state when no run matches", () => {
    render(<TransactionHistory />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    fireEvent.click(within(statusGroup).getByRole("checkbox", { name: /Failed/ }));

    expect(screen.getByText(/Showing 0 of 3 transactions/)).toBeInTheDocument();
    expect(screen.getByText(/no runs match\. try removing a filter\./i)).toBeInTheDocument();
  });

  it("respects archived mode counts", () => {
    render(<TransactionHistory mode="archived" />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by payroll status",
    });
    expect(within(statusGroup).getByRole("checkbox", { name: /Verified \(1/ })).toBeInTheDocument();

    fireEvent.click(within(statusGroup).getByRole("checkbox", { name: /Pending/ }));
    expect(
      screen.getByText(/Showing 0 of 1 archived payrolls/),
    ).toBeInTheDocument();
  });

  it("exposes only state labels — never amounts, employee data, wallets or hashes", () => {
    render(<TransactionHistory />);

    const toolbar = screen.getByTestId("payroll-quick-filters");
    const text = toolbar.textContent ?? "";

    // Amounts, tx hashes and ZK proofs from the mock pool must not appear.
    expect(text).not.toContain("9,500");
    expect(text).not.toContain("4,800");
    expect(text).not.toContain("0xzkproof");
    expect(text).not.toContain("abc123def456");
    expect(text).not.toContain("emp_");
    expect(text).not.toContain("tx_");
  });
});

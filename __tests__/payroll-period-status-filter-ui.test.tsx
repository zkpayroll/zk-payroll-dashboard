import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PeriodStatusFilter } from "@/components/payroll/PeriodStatusFilter";
import { MOCK_PAYROLL_PERIODS } from "@/src/payroll/periodStatusFilter";
import type { PayrollPeriod } from "@/src/payroll/periodStatusFilter";

const DRAFT_ONLY: PayrollPeriod[] = [
  {
    id: "2026-09",
    label: "September 2026",
    status: "draft",
    runCount: 1,
    updatedAt: "2026-09-25T10:00:00Z",
  },
];

describe("<PeriodStatusFilter />", () => {
  it("renders a filter option for every status plus All with counts", () => {
    render(<PeriodStatusFilter />);

    const group = screen.getByRole("radiogroup", {
      name: "Filter payroll periods by status",
    });

    expect(within(group).getByRole("radio", { name: /^All \(5 periods\)/ })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /^Draft \(1 period\)/ })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /^Active \(1 period\)/ })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /^Finalized \(2 periods\)/ })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: /^Archived \(1 period\)/ })).toBeInTheDocument();
  });

  it("lists every period by default", () => {
    render(<PeriodStatusFilter />);

    expect(screen.getByRole("status")).toHaveTextContent("All 5 periods listed");
    for (const period of MOCK_PAYROLL_PERIODS) {
      expect(screen.getByTestId(`payroll-period-${period.id}`)).toBeInTheDocument();
    }
  });

  it("narrows the list to a single status and reports the result", () => {
    const onFilterChange = vi.fn();
    render(<PeriodStatusFilter onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /^Finalized/ }));

    expect(onFilterChange).toHaveBeenCalledWith("finalized");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 finalized periods — 2 of 5",
    );
    expect(screen.getByTestId("payroll-period-2026-07")).toBeInTheDocument();
    expect(screen.getByTestId("payroll-period-2026-05")).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-period-2026-09")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payroll-period-2026-08")).not.toBeInTheDocument();
  });

  it("falls back to showing all periods when the initial status is invalid", () => {
    render(<PeriodStatusFilter initialStatus="not-a-status" />);

    expect(screen.getByRole("status")).toHaveTextContent("All 5 periods listed");
    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
  });

  it("offers an actionable empty state when no period has the selected status", () => {
    render(<PeriodStatusFilter periods={DRAFT_ONLY} />);

    fireEvent.click(screen.getByRole("radio", { name: /^Archived/ }));

    expect(screen.getByText("No archived periods")).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-period-2026-09")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all periods" }));

    expect(screen.getByTestId("payroll-period-2026-09")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("All 1 period listed");
  });

  it("respects an initial status and validates counts against the given list", () => {
    render(<PeriodStatusFilter initialStatus="archived" periods={DRAFT_ONLY} />);

    expect(screen.getByRole("radio", { name: /^Archived/ })).toBeChecked();
    expect(screen.getByText("No archived periods")).toBeInTheDocument();
  });

  it("exposes only lifecycle labels and counts — never amounts or private data", () => {
    render(<PeriodStatusFilter />);

    const text = screen.getByTestId("period-status-filter").textContent ?? "";
    expect(text).not.toMatch(/\$\d|9,500|salary|wallet|proof/i);
    expect(text).not.toMatch(/G[A-Z0-9]{55}/);
  });
});

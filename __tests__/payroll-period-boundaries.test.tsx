/**
 * Component tests for payroll period boundaries (issue #885).
 *
 * Covers how the period-facing payroll components behave at the edges of a
 * period: the last/first instant of a month, year rollovers, leap days,
 * quarter edges, timezone offsets that cross a UTC month boundary, impossible
 * calendar dates, and empty / single-item period lists.
 *
 * Privacy: fixtures carry only ids, timestamps, and lifecycle status. The
 * tests also assert that no amounts leak into period-level UI.
 */
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PeriodLabelBadge from "@/components/features/payroll/PeriodLabelBadge";
import PeriodSummaryCard from "@/components/features/payroll/PeriodSummaryCard";
import { PeriodStatusFilter } from "@/components/payroll/PeriodStatusFilter";
import { parsePeriod } from "@/lib/date/periodLabel";
import type { PayrollPeriod } from "@/src/payroll/periodStatusFilter";
import type { PayrollTransaction } from "@/types/models";

function tx(overrides: Partial<PayrollTransaction> = {}): PayrollTransaction {
  return {
    id: "tx_boundary",
    companyId: "company_001",
    timestamp: "2026-01-15T12:00:00Z",
    createdAt: "2026-01-15T12:00:00Z",
    totalAmount: 987654,
    employeeCount: 3,
    proof: "0xproof",
    status: "pending",
    ...overrides,
  };
}

function badgeText(period: unknown): string {
  const { unmount } = render(<PeriodLabelBadge period={period} />);
  const text = screen.getByTestId("period-label-badge").textContent ?? "";
  unmount();
  return text;
}

describe("PeriodLabelBadge — month and year boundaries", () => {
  it.each([
    ["2025-12-31T23:59:59.999Z", "December 2025"],
    ["2026-01-01T00:00:00.000Z", "January 2026"],
    ["2026-01-31T23:59:59Z", "January 2026"],
    ["2026-02-01T00:00:00Z", "February 2026"],
    ["2026-06-30T23:59:59Z", "June 2026"],
    ["2026-07-01T00:00:00Z", "July 2026"],
  ])("labels %s as %s", (input, expected) => {
    expect(badgeText(input)).toBe(expected);
  });

  it("places adjacent instants across a month boundary in different periods", () => {
    render(
      <>
        <PeriodLabelBadge period="2026-03-31T23:59:59Z" format="id" />
        <PeriodLabelBadge period="2026-04-01T00:00:00Z" format="id" />
      </>,
    );
    const [last, first] = screen.getAllByTestId("period-label-badge");
    expect(last).toHaveTextContent("2026-03");
    expect(first).toHaveTextContent("2026-04");
  });

  it("normalizes timezone offsets to UTC when they cross a month boundary", () => {
    // 00:30 on Feb 1 in UTC+01:00 is still Jan 31 in UTC.
    expect(badgeText("2026-02-01T00:30:00+01:00")).toBe("January 2026");
    // 20:00 on Jan 31 in UTC-05:00 is already Feb 1 in UTC.
    expect(badgeText("2026-01-31T20:00:00-05:00")).toBe("February 2026");
  });
});

describe("PeriodLabelBadge — leap days and impossible dates", () => {
  it("accepts Feb 29 in a leap year", () => {
    expect(badgeText("2028-02-29")).toBe("February 2028");
    expect(badgeText("2028-02-29T23:59:59Z")).toBe("February 2028");
  });

  it("does not roll Feb 29 in a non-leap year into March", () => {
    render(<PeriodLabelBadge period="2026-02-29" />);
    const badge = screen.getByTestId("period-label-badge");
    expect(badge).toHaveTextContent("Unassigned period");
    expect(badge).not.toHaveTextContent("March");
    expect(badge.className).toContain("border-dashed");
  });

  it.each(["2026-02-30", "2026-04-31", "2026-06-31T09:00:00Z", "2026-01-00"])(
    "treats impossible calendar date %s as unassigned",
    (input) => {
      expect(badgeText(input)).toBe("Unassigned period");
      expect(parsePeriod(input).error).toMatch(/Impossible calendar date/);
    },
  );

  it.each(["2026-13", "2026-00", "2026-13-01"])(
    "treats out-of-range month %s as unassigned",
    (input) => {
      expect(badgeText(input)).toBe("Unassigned period");
    },
  );

  it("keeps the last valid day of each 30-day month in its own period", () => {
    for (const [input, expected] of [
      ["2026-04-30", "April 2026"],
      ["2026-09-30", "September 2026"],
      ["2026-11-30", "November 2026"],
    ]) {
      expect(badgeText(input)).toBe(expected);
    }
  });
});

describe("PeriodLabelBadge — quarter boundaries", () => {
  it.each([
    ["Q1 2026", "Q1 2026"],
    ["2026-Q4", "Q4 2026"],
    ["q2 2026", "Q2 2026"],
  ])("labels %s as %s", (input, expected) => {
    expect(badgeText(input)).toBe(expected);
  });

  it.each(["Q0 2026", "Q5 2026"])("rejects out-of-range quarter %s", (input) => {
    expect(badgeText(input)).toBe("Unassigned period");
  });

  it("renders quarter ids in the card variant", () => {
    render(<PeriodLabelBadge period="2026-Q4" variant="card" format="id" />);
    expect(screen.getByTestId("period-card")).toHaveAttribute(
      "aria-label",
      "Pay Period: 2026-Q4",
    );
  });
});

describe("PeriodSummaryCard — period boundaries", () => {
  it("derives the period label from the first transaction at a year boundary", () => {
    render(
      <PeriodSummaryCard
        isLoading={false}
        transactions={[tx({ createdAt: "2025-12-31T23:59:59Z", timestamp: "" })]}
      />,
    );
    expect(screen.getByText("December 2025")).toBeInTheDocument();
  });

  it("falls back to an empty label when the first transaction date is impossible", () => {
    render(
      <PeriodSummaryCard
        isLoading={false}
        transactions={[tx({ createdAt: "2026-02-30T10:00:00Z", timestamp: "" })]}
      />,
    );
    expect(screen.queryByText(/March 2026/)).not.toBeInTheDocument();
  });

  it("shows the empty state for a period with no transactions", () => {
    render(<PeriodSummaryCard isLoading={false} transactions={[]} />);
    expect(screen.getByText("Current period")).toBeInTheDocument();
    expect(screen.getByText("No batches in this period")).toBeInTheDocument();
  });

  it("counts a single transaction into exactly one lifecycle bucket", () => {
    render(
      <PeriodSummaryCard
        isLoading={false}
        periodLabel="January 2026"
        transactions={[tx({ status: "verified" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const counts = items.map((item) => ({
      label: item.querySelector("p.text-xs")?.textContent,
      value: item.querySelector("p.text-2xl")?.textContent,
    }));
    expect(counts).toEqual([
      { label: "Drafts", value: "0" },
      { label: "Locked", value: "0" },
      { label: "Cancelled", value: "0" },
      { label: "Settled", value: "1" },
    ]);
  });

  it("never renders transaction amounts at the period level", () => {
    const { container } = render(
      <PeriodSummaryCard
        isLoading={false}
        transactions={[tx(), tx({ id: "tx_2", approvalStatus: "draft" })]}
      />,
    );
    expect(container.textContent).not.toContain("987654");
    expect(container.textContent).not.toContain("987,654");
  });

  it("ignores an invalid explicit lastUpdated value instead of rendering 'Invalid Date'", () => {
    render(
      <PeriodSummaryCard
        isLoading={false}
        periodLabel="January 2026"
        transactions={[tx()]}
        lastUpdated="not-a-date"
      />,
    );
    expect(screen.queryByLabelText("Last updated")).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});

describe("PeriodStatusFilter — list boundaries", () => {
  const yearBoundaryPeriods: PayrollPeriod[] = [
    { id: "2026-01", label: "January 2026", status: "active", runCount: 1 },
    { id: "2025-12", label: "December 2025", status: "finalized", runCount: 0 },
  ];

  it("renders periods on both sides of a year boundary in the given order", () => {
    render(<PeriodStatusFilter periods={yearBoundaryPeriods} />);
    const list = screen.getByTestId("period-status-list");
    const labels = within(list)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("p")?.textContent);
    expect(labels).toEqual(["January 2026", "December 2025"]);
  });

  it("uses singular and zero run-count copy correctly", () => {
    render(<PeriodStatusFilter periods={yearBoundaryPeriods} />);
    expect(
      within(screen.getByTestId("payroll-period-2026-01")).getByText(/^1 payroll run$/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("payroll-period-2025-12")).getByText(/^0 payroll runs$/),
    ).toBeInTheDocument();
  });

  it("shows 'Run count unavailable' when a period has no run count", () => {
    render(
      <PeriodStatusFilter
        periods={[{ id: "2026-02", label: "February 2026", status: "draft" }]}
      />,
    );
    expect(screen.getByText("Run count unavailable")).toBeInTheDocument();
  });

  it("uses singular summary copy for exactly one period", () => {
    render(
      <PeriodStatusFilter
        periods={[{ id: "2026-02", label: "February 2026", status: "draft" }]}
      />,
    );
    expect(screen.getByText("All 1 period listed")).toBeInTheDocument();
  });

  it("shows the empty state when no periods exist at all", () => {
    render(<PeriodStatusFilter periods={[]} />);
    expect(screen.getByText("No payroll periods yet")).toBeInTheDocument();
    expect(screen.getByText("All 0 periods listed")).toBeInTheDocument();
  });

  it("recovers from an empty status bucket back to the full list", () => {
    render(<PeriodStatusFilter periods={yearBoundaryPeriods} initialStatus="archived" />);
    expect(screen.getByText("No archived periods")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all periods" }));
    expect(screen.getByText("All 2 periods listed")).toBeInTheDocument();
    expect(screen.getByTestId("payroll-period-2025-12")).toBeInTheDocument();
  });

  it("falls back to all periods for an unknown initial status", () => {
    render(<PeriodStatusFilter periods={yearBoundaryPeriods} initialStatus="closed" />);
    expect(screen.getByText("All 2 periods listed")).toBeInTheDocument();
  });
});

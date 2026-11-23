import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPayrollOperationsHealthCard from "@/components/features/dashboard/DashboardPayrollOperationsHealthCard";
import type { PayrollHealthRun } from "@/lib/payroll/operationsHealth";

const NOW = new Date("2026-06-30T12:00:00Z");

function run(id: string, status: PayrollHealthRun["status"], daysAgo: number): PayrollHealthRun {
  return {
    id,
    status,
    timestamp: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 9_500,
    reconciliationStatus: status === "verified" ? "matched" : "pending",
  };
}

describe("DashboardPayrollOperationsHealthCard", () => {
  it("shows a healthy score with no factors", () => {
    render(
      <DashboardPayrollOperationsHealthCard
        runs={[run("r1", "verified", 1), run("r2", "verified", 31)]}
        treasuryBalance={45_000}
        nextRunAmount={19_500}
        now={NOW}
      />,
    );

    const card = screen.getByRole("status");
    expect(card).toHaveAttribute("data-status", "healthy");
    expect(card).toHaveAttribute("data-score", "100");
    expect(within(card).getByRole("heading", { name: "Payroll operations health" })).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByTestId("payroll-operations-health-score")).toHaveTextContent("100");
    expect(screen.getByText(/No issues detected/)).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-operations-health-factors")).not.toBeInTheDocument();
  });

  it("announces a critical score as an alert and lists the top factors with actions", () => {
    render(
      <DashboardPayrollOperationsHealthCard
        runs={[
          run("r1", "failed", 2),
          run("r2", "failed", 10),
          run("r3", "verified", 20),
          run("r4", "pending", 5),
          run("r5", "paused", 1),
        ]}
        treasuryBalance={5_000}
        nextRunAmount={19_500}
        now={NOW}
        maxFactors={2}
      />,
    );

    const card = screen.getByRole("alert");
    expect(card).toHaveAttribute("data-status", "critical");
    expect(screen.getByText("Critical", { selector: "span.rounded-full" })).toBeInTheDocument();

    const factors = within(screen.getByTestId("payroll-operations-health-factors")).getAllByRole(
      "listitem",
    );
    expect(factors).toHaveLength(2);
    expect(factors[0]).toHaveAttribute("data-factor", "underfunded_next_run");
    expect(factors[1]).toHaveAttribute("data-factor", "failed_runs");
    expect(factors[1]).toHaveTextContent("2 failed payroll runs in the last 5 runs");
    expect(within(factors[0]).getByRole("link", { name: "Fund treasury" })).toHaveAttribute(
      "href",
      "/treasury",
    );
    expect(screen.getByText("2 more factors not shown.")).toBeInTheDocument();
  });

  it("shows an insufficient-data state without a score when there are no runs", () => {
    render(<DashboardPayrollOperationsHealthCard runs={[]} treasuryBalance={null} nextRunAmount={null} now={NOW} />);

    const card = screen.getByRole("status");
    expect(card).toHaveAttribute("data-status", "insufficient_data");
    expect(card).toHaveAttribute("data-score", "");
    expect(screen.getByText("Insufficient data")).toBeInTheDocument();
    expect(screen.getByText(/No payroll runs recorded yet/)).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-operations-health-score")).not.toBeInTheDocument();
    expect(card.textContent).not.toContain("NaN");
  });

  it("lists data issues for malformed runs", () => {
    render(
      <DashboardPayrollOperationsHealthCard
        runs={[{ ...run("r1", "verified", 1), timestamp: "not-a-date" }, run("r2", "verified", 2)]}
        treasuryBalance={45_000}
        nextRunAmount={19_500}
        now={NOW}
      />,
    );

    expect(
      within(screen.getByTestId("payroll-operations-health-issues")).getByText(
        "Payroll run r1 has an invalid timestamp and was excluded from the score.",
      ),
    ).toBeInTheDocument();
  });
});

describe("DashboardHome wiring", () => {
  it("mounts the health card inside an ErrorBoundary", () => {
    // DashboardHome is wallet-gated and not renderable in jsdom, so assert the
    // wiring directly, as the other dashboard checks do.
    const source = readFileSync(
      join(process.cwd(), "components/features/dashboard/DashboardHome.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import DashboardPayrollOperationsHealthCard from "@/components/features/dashboard/DashboardPayrollOperationsHealthCard"',
    );
    expect(source).toMatch(
      /<ErrorBoundary>\s*<DashboardPayrollOperationsHealthCard \/>\s*<\/ErrorBoundary>/,
    );
  });
});

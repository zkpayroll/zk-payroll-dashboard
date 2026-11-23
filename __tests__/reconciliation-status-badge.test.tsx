import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  ReconciliationBadge,
  ReconciliationStatusBadge,
} from "@/components/features/payroll/ReconciliationBadge";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

const states = [
  ["matched", "Matched"],
  ["pending", "Pending"],
  ["mismatched", "Mismatched"],
  ["failed", "Failed"],
  ["manually_reviewed", "Manually reviewed"],
] as const;

describe("ReconciliationStatusBadge", () => {
  it.each(states)("renders the %s state with a namespaced label", (status, label) => {
    render(<ReconciliationStatusBadge status={status} />);

    const badge = screen.getByRole("status", {
      name: `Reconciliation: ${label}`,
    });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(label);
    expect(badge.querySelector("svg")).toBeInTheDocument();
  });

  it("provides actionable, value-free feedback for a failure", () => {
    render(<ReconciliationStatusBadge status="failed" />);

    const badge = screen.getByRole("status", { name: "Reconciliation: Failed" });
    expect(badge).toHaveAttribute(
      "title",
      "Reconciliation could not complete. Open the payroll run to review and retry.",
    );
    expect(badge).not.toHaveTextContent("salary");
    expect(badge).not.toHaveTextContent("amount");
  });

  it("can hide its icon without changing the accessible name", () => {
    render(<ReconciliationStatusBadge status="matched" showIcon={false} />);

    const badge = screen.getByRole("status", {
      name: "Reconciliation: Matched",
    });
    expect(badge.querySelector("svg")).not.toBeInTheDocument();
  });

  it("falls back to pending for an unknown runtime value", () => {
    render(<ReconciliationStatusBadge status={"unknown" as never} />);

    expect(
      screen.getByRole("status", { name: "Reconciliation: Pending" }),
    ).toBeInTheDocument();
  });

  it("keeps discrepancy text out of the legacy detailed badge", () => {
    const privateDiscrepancy = "Employee Alice salary differs by 500";
    const run = {
      ...MOCK_PAYROLL_RUNS[0],
      reconciliationDetails: {
        processedCount: 1,
        totalCount: 2,
        discrepancies: [privateDiscrepancy],
      },
    };

    render(<ReconciliationBadge payrollRun={run} variant="detailed" />);

    expect(screen.queryByText(privateDiscrepancy)).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Reconciliation: Matched" })).toBeInTheDocument();
  });

  it("does not share the payment status accessible name", () => {
    render(
      <>
        <StatusBadge status="pending" />
        <ReconciliationStatusBadge status="pending" />
      </>,
    );

    expect(
      screen.getByRole("status", { name: "Status: Pending" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Reconciliation: Pending" }),
    ).toBeInTheDocument();
  });
});

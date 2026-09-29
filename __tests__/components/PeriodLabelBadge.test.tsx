import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PeriodLabelBadge from "@/components/features/payroll/PeriodLabelBadge";
import type { PayrollRun } from "@/types/models";

const mockRun: PayrollRun = {
  id: "run_test_01",
  companyId: "company_001",
  timestamp: "2025-02-28T09:01:00Z",
  createdAt: "2025-02-28T09:01:00Z",
  totalAmount: 9500,
  employeeCount: 2,
  proof: "0xproof",
  status: "verified",
  employeeIds: ["emp_1", "emp_2"],
};

describe("PeriodLabelBadge component", () => {
  it("renders a period label for a payroll run in default badge variant", () => {
    render(<PeriodLabelBadge run={mockRun} />);
    const badge = screen.getByTestId("period-label-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("February 2025");
    expect(badge).toHaveAttribute("aria-label", "Pay period: February 2025");
  });

  it("renders short formatting style when requested", () => {
    render(<PeriodLabelBadge period="2025-02-28T09:01:00Z" format="short" />);
    expect(screen.getByText("Feb 2025")).toBeInTheDocument();
  });

  it("renders pill variant styling", () => {
    render(<PeriodLabelBadge period="2026-07" variant="pill" size="xs" />);
    const badge = screen.getByTestId("period-label-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("July 2026");
    expect(badge.className).toContain("rounded-full");
  });

  it("renders card variant for detail metadata sections", () => {
    render(<PeriodLabelBadge period={mockRun} variant="card" />);
    const card = screen.getByTestId("period-card");
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Pay Period")).toBeInTheDocument();
    expect(screen.getByText("February 2025")).toBeInTheDocument();
  });

  it("renders inline variant", () => {
    render(<PeriodLabelBadge period="Q1 2026" variant="inline" />);
    const inline = screen.getByTestId("period-inline");
    expect(inline).toBeInTheDocument();
    expect(inline).toHaveTextContent("Q1 2026");
  });

  it("prepends prefix when showPrefix or custom prefix is enabled", () => {
    render(<PeriodLabelBadge period="2025-03" showPrefix={true} />);
    expect(screen.getByText("Period: March 2025")).toBeInTheDocument();

    render(<PeriodLabelBadge period="2025-04" prefix="Cycle: " />);
    expect(screen.getByText("Cycle: April 2025")).toBeInTheDocument();
  });

  // Failure & fallback states
  it("renders custom fallback text when period is missing or invalid", () => {
    render(<PeriodLabelBadge period={null} fallback="Unassigned Period" />);
    const badge = screen.getByTestId("period-label-badge");
    expect(badge).toHaveTextContent("Unassigned Period");
  });

  it("handles malformed period strings gracefully with error indicator style", () => {
    render(<PeriodLabelBadge period="not-a-valid-date" />);
    const badge = screen.getByTestId("period-label-badge");
    expect(badge).toHaveTextContent("Unassigned period");
    expect(badge.className).toContain("border-dashed");
  });
});

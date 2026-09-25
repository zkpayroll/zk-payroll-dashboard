import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollIssueHandoffPanel from "@/components/handoff/PayrollIssueHandoffPanel";
import type { PayrollIssueHandoffItem } from "@/src/issues";

const issue: PayrollIssueHandoffItem = {
  id: "issue-1",
  title: "Proof review is blocked",
  blocker: "Approval is still pending.",
  owner: "Payroll operations",
  nextAction: "Review the approval status.",
  coordinationNotes: "Coordinate with compliance.",
  status: "unresolved",
};

describe("PayrollIssueHandoffPanel", () => {
  it("renders the populated handoff lifecycle", () => {
    render(<PayrollIssueHandoffPanel issues={[issue]} />);

    expect(screen.getByRole("heading", { name: "Payroll issue handoff" })).toBeInTheDocument();
    expect(screen.getByText(issue.blocker)).toBeInTheDocument();
    expect(screen.getByText(issue.owner!)).toBeInTheDocument();
    expect(screen.getByText(issue.nextAction)).toBeInTheDocument();
    expect(screen.getByText(issue.coordinationNotes!)).toBeInTheDocument();
  });

  it("renders loading, failure, and empty states", () => {
    const { rerender } = render(<PayrollIssueHandoffPanel isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);

    const onRetry = vi.fn();
    rerender(<PayrollIssueHandoffPanel error="The handoff service is unavailable." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
    screen.getByRole("button", { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<PayrollIssueHandoffPanel />);
    expect(screen.getByText(/no unresolved payroll issues/i)).toBeInTheDocument();
  });

  it("does not render malformed items and shows unassigned optional fields", () => {
    render(
      <PayrollIssueHandoffPanel
        issues={[
          { ...issue, id: "", owner: "   ", coordinationNotes: "   " },
          { ...issue, id: "issue-2", owner: undefined, coordinationNotes: undefined },
        ]}
      />,
    );

    expect(screen.getAllByText("Unassigned")).toHaveLength(1);
    expect(screen.getByText("No coordination notes yet.")).toBeInTheDocument();
    expect(screen.getAllByText(issue.title)).toHaveLength(1);
  });
});
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReviewerWorkloadSummary from "@/components/reviewers/ReviewerWorkloadSummary";
import type { ApprovalDraft } from "@/stores/approvalQueue";

const draft = (overrides: Partial<ApprovalDraft>): ApprovalDraft => ({
  id: "draft-1",
  companyId: "company-1",
  timestamp: "2026-07-29T10:00:00Z",
  createdAt: "2026-07-29T10:00:00Z",
  totalAmount: 1,
  employeeCount: 1,
  proof: "proof-reference",
  status: "pending",
  approvalStatus: "pending_executive_approval",
  requiresExecutiveReview: true,
  employeeIds: [],
  executedAt: null,
  transactionHash: null,
  reviewerName: "Alex Reviewer",
  ...overrides,
});

describe("ReviewerWorkloadSummary", () => {
  it("shows pending, overdue, and completed approval metrics", () => {
    render(
      <ReviewerWorkloadSummary
        drafts={[
          draft({}),
          draft({ id: "draft-2", createdAt: "2026-01-01T00:00:00Z" }),
          draft({ id: "draft-3", approvalStatus: "approved" }),
        ]}
      />,
    );

    expect(screen.getByText("Alex Reviewer")).toBeInTheDocument();
    expect(screen.getByText("2 pending")).toBeInTheDocument();
    expect(screen.getAllByText("2 overdue").length).toBeGreaterThan(0);
    expect(screen.getByText("1 completed")).toBeInTheDocument();
  });

  it("renders loading and failure states", () => {
    const { rerender } = render(<ReviewerWorkloadSummary drafts={[]} isLoading />);
    expect(screen.getByText("Loading reviewer workload")).toBeInTheDocument();

    rerender(<ReviewerWorkloadSummary drafts={[]} error="Approval service unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Approval service unavailable");
  });

  it("handles an empty queue and zero overdue actions", () => {
    render(
      <ReviewerWorkloadSummary
        drafts={[draft({ createdAt: new Date().toISOString() })]}
      />,
    );

    expect(screen.getByText("0 overdue")).toBeInTheDocument();
    expect(screen.queryByText("No reviewer actions are waiting for attention.")).not.toBeInTheDocument();

    render(<ReviewerWorkloadSummary drafts={[]} />);
    expect(screen.getByText("No reviewer actions are waiting for attention.")).toBeInTheDocument();
  });
});
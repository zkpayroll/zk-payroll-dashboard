import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import { useApprovalQueueStore } from "@/stores/approvalQueue";

describe("Executive Approval Queue (Issue #218)", () => {
  beforeEach(() => {
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: "draft_test_100",
          companyId: "company_001",
          timestamp: "2026-07-29T10:00:00Z",
          createdAt: "2026-07-29T10:00:00Z",
          totalAmount: 150000,
          employeeCount: 10,
          proof: "0xzkproof_test_100",
          status: "pending",
          approvalStatus: "pending_executive_approval",
          requiresExecutiveReview: true,
          employeeIds: ["emp_001"],
          notes: "High-value Q3 bonus run",
          approvalHistory: [],
        },
      ],
    });
  });

  it("renders pending executive approval drafts", () => {
    render(<ExecutiveApprovalQueue />);
    expect(screen.getByText("Executive Approval Queue")).toBeInTheDocument();
    expect(screen.getByText("draft_test_100")).toBeInTheDocument();
    expect(screen.getByText("$150,000 USD")).toBeInTheDocument();
  });

  it("allows approving a payroll draft for signing", () => {
    render(<ExecutiveApprovalQueue />);
    const approveBtn = screen.getByText("Approve & Queue for Signing");
    fireEvent.click(approveBtn);

    const store = useApprovalQueueStore.getState();
    const approvedDraft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(approvedDraft?.approvalStatus).toBe("approved");
    expect(approvedDraft?.approvalHistory).toHaveLength(1);
  });

  it("allows rejecting a payroll draft", () => {
    render(<ExecutiveApprovalQueue />);
    const rejectBtn = screen.getByText("Reject Draft");
    fireEvent.click(rejectBtn);

    const store = useApprovalQueueStore.getState();
    const rejectedDraft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(rejectedDraft?.approvalStatus).toBe("rejected");
    expect(rejectedDraft?.status).toBe("cancelled");
  });
});

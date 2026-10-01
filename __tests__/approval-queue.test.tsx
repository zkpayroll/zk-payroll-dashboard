import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import { useApprovalQueueStore } from "@/stores/approvalQueue";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  it("blocks requesting a correction without a comment", () => {
    render(<ExecutiveApprovalQueue />);
    fireEvent.click(screen.getByText("Request Correction"));

    expect(
      screen.getByText(/add a comment describing what needs to change/i),
    ).toBeInTheDocument();

    const store = useApprovalQueueStore.getState();
    const draft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
  });

  it("requests a correction with a comment, keeping the draft alive (not cancelled)", () => {
    render(<ExecutiveApprovalQueue />);

    const input = screen.getByPlaceholderText(/add executive review notes/i);
    fireEvent.change(input, { target: { value: "Employee emp_003 salary looks off" } });
    fireEvent.click(screen.getByText("Request Correction"));

    const store = useApprovalQueueStore.getState();
    const draft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(draft?.approvalStatus).toBe("correction_requested");
    expect(draft?.status).toBe("pending");
    expect(draft?.approvalHistory).toHaveLength(1);
    expect(draft?.approvalHistory?.[0]).toMatchObject({
      action: "correction_requested",
      comment: "Employee emp_003 salary looks off",
    });
  });

  it("allows resubmitting a draft with corrections requested back into the pending queue", () => {
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
          approvalStatus: "correction_requested",
          requiresExecutiveReview: true,
          employeeIds: ["emp_001"],
          notes: "High-value Q3 bonus run",
          approvalHistory: [
            {
              approvedBy: "Executive Admin",
              approvedAt: "2026-07-29T11:00:00Z",
              role: "Admin",
              comment: "Please fix employee count",
              action: "correction_requested",
            },
          ],
        },
      ],
    });

    render(<ExecutiveApprovalQueue />);
    fireEvent.click(screen.getByText(/corrections requested/i));
    fireEvent.click(screen.getByText("Resubmit for Review"));

    const store = useApprovalQueueStore.getState();
    const draft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
    expect(draft?.approvalHistory).toHaveLength(2);
    expect(draft?.approvalHistory?.[1].action).toBe("resubmitted");
  });

  it("expires correction requests after seven days and blocks resubmission", () => {
    const expiredAt = new Date(Date.now() - SEVEN_DAYS_MS - 24 * 60 * 60 * 1000).toISOString();
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: "draft_expired",
          companyId: "company_001",
          timestamp: expiredAt,
          createdAt: expiredAt,
          totalAmount: 1000,
          employeeCount: 1,
          proof: "proof",
          status: "pending",
          approvalStatus: "correction_requested",
          requiresExecutiveReview: true,
          employeeIds: [],
          approvalHistory: [{
            approvedBy: "Executive Admin",
            approvedAt: expiredAt,
            role: "Admin",
            comment: "Please review the payroll details",
            action: "correction_requested",
          }],
        },
      ],
    });

    render(<ExecutiveApprovalQueue />);
    fireEvent.click(screen.getByText(/corrections requested/i));

    expect(screen.getByText(/expired after seven days/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resubmit for review/i })).toBeDisabled();
    const result = useApprovalQueueStore.getState().resubmitDraft("draft_expired", "Drafter", "Operator");
    expect(result).toMatchObject({ ok: false, conflict: { reason: "correction_expired" } });
    expect(useApprovalQueueStore.getState().drafts[0].approvalStatus).toBe("correction_requested");
  });
});

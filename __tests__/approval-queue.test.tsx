import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import { useApprovalQueueStore } from "@/stores/approvalQueue";
import { usePayrollPolicyStore, DEFAULT_PAYROLL_POLICY } from "@/stores/payrollPolicy";
import { requiredApprovalsFor } from "@/lib/payroll/approvalConflict";
import { useTreasuryStore } from "@/stores/treasury";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe("Executive Approval Queue (Issue #218)", () => {
  beforeEach(() => {
    usePayrollPolicyStore.setState({
      policy: JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY)),
    });
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: "draft_test_100",
          companyId: "company_001",
          timestamp: "2026-07-29T10:00:00Z",
          createdAt: "2026-07-29T10:00:00Z",
          // Below the default dualApprovalThreshold ($50,000) so this
          // shared fixture exercises the single-approval path; the quorum
          // path (#664) has its own fixtures below.
          totalAmount: 10000,
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
    expect(screen.getByText("$10,000 USD")).toBeInTheDocument();
  });

  it("requires the policy's baseline approval count before releasing a draft", () => {
    // The org policy's `requiredApprovalsCount` baseline is 2 (#664), so even
    // a low-value draft under the dual-approval threshold needs two distinct
    // approvals — a single "Approve" click is not enough on its own.
    render(<ExecutiveApprovalQueue />);
    fireEvent.click(screen.getByText("Approve & Queue for Signing"));

    let store = useApprovalQueueStore.getState();
    let draft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
    expect(draft?.approvalHistory).toHaveLength(1);

    const reviewerInput = screen.getByLabelText(/reviewer name/i);
    fireEvent.change(reviewerInput, { target: { value: "Second Executive" } });
    fireEvent.click(screen.getByText("Approve & Queue for Signing"));

    store = useApprovalQueueStore.getState();
    draft = store.drafts.find((d) => d.id === "draft_test_100");
    expect(draft?.approvalStatus).toBe("approved");
    expect(draft?.approvalHistory).toHaveLength(2);
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

describe("Approval quorum (Issue #664)", () => {
  beforeEach(() => {
    usePayrollPolicyStore.setState({
      policy: JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY)),
    });
    // Ample treasury balance (#666) so these quorum tests exercise the
    // approval-count gate in isolation; the reservation-sufficiency gate has
    // its own dedicated tests below.
    useTreasuryStore.setState({
      balances: { USDC: { assetCode: "USDC", available: 500000, reserved: 0, projected: 0 } },
      obligations: [],
    });
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: "draft_quorum_001",
          companyId: "company_001",
          timestamp: "2026-07-29T10:00:00Z",
          createdAt: "2026-07-29T10:00:00Z",
          totalAmount: 145000,
          employeeCount: 18,
          proof: "0xzkproof_exec_145k",
          status: "pending",
          approvalStatus: "pending_executive_approval",
          requiresExecutiveReview: true,
          employeeIds: ["emp_001"],
          notes: "High-value run requiring dual approval",
          approvalHistory: [],
        },
      ],
    });
  });

  it("computes 2 required approvals for a draft at/above the dual-approval threshold", () => {
    const policy = usePayrollPolicyStore.getState().policy.approvals;
    const required = requiredApprovalsFor({
      requiredApprovalsCount: policy.requiredApprovalsCount,
      requireDualApproval: policy.requireDualApproval,
      dualApprovalThreshold: policy.dualApprovalThreshold,
      totalAmount: 145000,
    });
    expect(required).toBe(2);
  });

  it("does not release a high-value draft after a single approval", () => {
    render(<ExecutiveApprovalQueue />);
    fireEvent.click(screen.getByText("Approve & Queue for Signing"));

    const draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_quorum_001");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
    expect(draft?.approvalHistory).toHaveLength(1);
    expect(screen.getByText(/1 of 2 approvals/i)).toBeInTheDocument();
  });

  it("releases a high-value draft once two distinct reviewers approve", () => {
    render(<ExecutiveApprovalQueue />);

    fireEvent.click(screen.getByText("Approve & Queue for Signing"));
    let draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_quorum_001");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");

    const reviewerInput = screen.getByLabelText(/reviewer name/i);
    fireEvent.change(reviewerInput, { target: { value: "Second Executive" } });
    fireEvent.click(screen.getByText("Approve & Queue for Signing"));

    draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_quorum_001");
    expect(draft?.approvalStatus).toBe("approved");
    expect(draft?.approvalHistory).toHaveLength(2);
    expect(draft?.approvalHistory?.map((h) => h.approvedBy)).toEqual([
      "Executive Admin",
      "Second Executive",
    ]);
  });

  it("refuses a second approval attempt from the same reviewer while quorum is unmet", () => {
    const result1 = useApprovalQueueStore.getState().approveDraft("draft_quorum_001", "Exec A", "Admin");
    expect(result1.ok).toBe(true);
    const result2 = useApprovalQueueStore.getState().approveDraft("draft_quorum_001", "Exec A", "Admin");
    expect(result2).toMatchObject({ ok: false, conflict: { reason: "already_decided_by_you" } });

    const draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_quorum_001");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
    expect(draft?.approvalHistory).toHaveLength(1);
  });

  it("rejects a quorum-pending draft outright, discarding partial approval progress", () => {
    useApprovalQueueStore.getState().approveDraft("draft_quorum_001", "Exec A", "Admin");
    const result = useApprovalQueueStore.getState().rejectDraft("draft_quorum_001", "Exec B", "Admin", "Numbers look off");
    expect(result.ok).toBe(true);

    const draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_quorum_001");
    expect(draft?.approvalStatus).toBe("rejected");
    expect(draft?.status).toBe("cancelled");
  });
});

describe("Treasury reservation on approval (Issue #666)", () => {
  beforeEach(() => {
    usePayrollPolicyStore.setState({
      policy: JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY)),
    });
    useTreasuryStore.setState({
      balances: { USDC: { assetCode: "USDC", available: 100000, reserved: 0, projected: 0 } },
      obligations: [],
    });
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: "draft_treasury_001",
          companyId: "company_001",
          timestamp: "2026-07-29T10:00:00Z",
          createdAt: "2026-07-29T10:00:00Z",
          // Below the dual-approval threshold, so a single approval reaches
          // quorum (baseline requiredApprovalsCount is already 2 by default
          // in this fixture's policy override below) — kept deliberately
          // simple: policy overridden to a 1-approval baseline so this suite
          // can isolate the treasury gate from the quorum gate (#664).
          totalAmount: 90000,
          employeeCount: 5,
          proof: "0xzkproof_treasury_90k",
          status: "pending",
          approvalStatus: "pending_executive_approval",
          requiresExecutiveReview: true,
          employeeIds: ["emp_001"],
          notes: "Single-asset payroll run for treasury reservation test",
          approvalHistory: [],
        },
      ],
    });
    usePayrollPolicyStore.setState((state) => ({
      policy: {
        ...state.policy,
        approvals: { ...state.policy.approvals, requiredApprovalsCount: 1, requireDualApproval: false },
      },
    }));
  });

  it("reserves treasury funds once a draft is approved", () => {
    const result = useApprovalQueueStore.getState().approveDraft("draft_treasury_001", "Exec A", "Admin");
    expect(result.ok).toBe(true);

    const draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_treasury_001");
    expect(draft?.approvalStatus).toBe("approved");

    const balance = useTreasuryStore.getState().balances.USDC;
    expect(balance.available).toBe(10000);
    expect(balance.reserved).toBe(90000);
    expect(useTreasuryStore.getState().obligations).toHaveLength(1);
  });

  it("refuses to approve a draft that would reserve more than the available treasury balance", () => {
    useTreasuryStore.setState({
      balances: { USDC: { assetCode: "USDC", available: 50000, reserved: 0, projected: 0 } },
    });

    const result = useApprovalQueueStore.getState().approveDraft("draft_treasury_001", "Exec A", "Admin");
    expect(result).toMatchObject({ ok: false, conflict: { reason: "insufficient_treasury_reservation" } });

    const draft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_treasury_001");
    expect(draft?.approvalStatus).toBe("pending_executive_approval");
    expect(draft?.approvalHistory).toHaveLength(0);
    expect(useTreasuryStore.getState().balances.USDC.reserved).toBe(0);
  });

  it("blocks a second draft from over-reserving funds already held by a first approved draft", () => {
    useApprovalQueueStore.setState((state) => ({
      drafts: [
        ...state.drafts,
        {
          id: "draft_treasury_002",
          companyId: "company_001",
          timestamp: "2026-07-29T10:00:00Z",
          createdAt: "2026-07-29T10:00:00Z",
          totalAmount: 60000,
          employeeCount: 3,
          proof: "0xzkproof_treasury_60k",
          status: "pending",
          approvalStatus: "pending_executive_approval",
          requiresExecutiveReview: true,
          employeeIds: ["emp_002"],
          notes: "Second concurrent run competing for the same treasury balance",
          approvalHistory: [],
        },
      ],
    }));

    const first = useApprovalQueueStore.getState().approveDraft("draft_treasury_001", "Exec A", "Admin");
    expect(first.ok).toBe(true);
    // $100,000 available - $90,000 reserved by draft_treasury_001 = $10,000
    // left — not enough for draft_treasury_002's $60,000, even though a
    // stale balance-only check (ignoring reservations) would have approved
    // it against the original $100,000 balance.
    const second = useApprovalQueueStore.getState().approveDraft("draft_treasury_002", "Exec A", "Admin");
    expect(second).toMatchObject({ ok: false, conflict: { reason: "insufficient_treasury_reservation" } });

    const secondDraft = useApprovalQueueStore.getState().drafts.find((d) => d.id === "draft_treasury_002");
    expect(secondDraft?.approvalStatus).toBe("pending_executive_approval");
  });

  it("does not touch treasury reservations when rejecting a draft that never reached quorum", () => {
    // The common path: rejectDraft on a still-pending draft. No funds were
    // ever reserved for it, so rejection must be a complete no-op on the
    // treasury store — this guards against a future refactor accidentally
    // calling releaseReservation for a draft that was never approved.
    const result = useApprovalQueueStore.getState().rejectDraft("draft_treasury_001", "Exec A", "Admin", "Not needed");
    expect(result.ok).toBe(true);
    expect(useTreasuryStore.getState().balances.USDC.reserved).toBe(0);
    expect(useTreasuryStore.getState().obligations).toHaveLength(0);
  });
});

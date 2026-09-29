import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateApprovalAction,
  approvalStatusLabel,
  type ApprovalSnapshot,
} from "@/lib/payroll/approvalConflict";
import { useApprovalQueueStore } from "@/stores/approvalQueue";

function snapshot(over: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot {
  return { approvalStatus: "pending_executive_approval", approvalHistory: [], ...over };
}

describe("evaluateApprovalAction", () => {
  it("allows a first decision on a pending payroll", () => {
    expect(evaluateApprovalAction(snapshot(), "approved", "A").ok).toBe(true);
    expect(evaluateApprovalAction(snapshot(), "rejected", "A").ok).toBe(true);
    expect(
      evaluateApprovalAction(snapshot(), "correction_requested", "A").ok,
    ).toBe(true);
  });

  it("refuses a second decision once approved, naming who got there first", () => {
    const result = evaluateApprovalAction(
      snapshot({
        approvalStatus: "approved",
        approvalHistory: [
          {
            approvedBy: "CFO",
            approvedAt: "2026-09-28T10:00:00Z",
            role: "Finance Director",
            action: "approved",
          },
        ],
      }),
      "approved",
      "Second Exec",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("already_approved");
    expect(result.conflict.currentStatus).toBe("approved");
    expect(result.conflict.conflictingReviewer).toBe("CFO");
    expect(result.conflict.message).toContain("CFO");
    expect(result.conflict.message).toContain("already approved");
  });

  it("refuses the exact lost-update case: approve then a stale reject", () => {
    // This is the bug the issue describes: the reject used to land, flipping
    // the run from approved to rejected/cancelled and discarding the approval.
    const afterApproval = snapshot({
      approvalStatus: "approved",
      approvalHistory: [
        { approvedBy: "CFO", approvedAt: "2026-09-28T10:00:00Z", action: "approved" },
      ],
    });

    const result = evaluateApprovalAction(afterApproval, "rejected", "Second Exec");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("already_approved");
  });

  it("refuses approving an already-rejected payroll and says what to do instead", () => {
    const result = evaluateApprovalAction(
      snapshot({
        approvalStatus: "rejected",
        approvalHistory: [
          { approvedBy: "CFO", approvedAt: "2026-09-28T10:00:00Z", action: "rejected" },
        ],
      }),
      "approved",
      "Second Exec",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("already_rejected");
    expect(result.conflict.message).toMatch(/corrected and resubmitted/i);
  });

  it("blocks a second decision while a correction is outstanding", () => {
    const result = evaluateApprovalAction(
      snapshot({
        approvalStatus: "correction_requested",
        approvalHistory: [
          {
            approvedBy: "CFO",
            approvedAt: "2026-09-28T10:00:00Z",
            role: "Finance Director",
            action: "correction_requested",
          },
        ],
      }),
      "approved",
      "Second Exec",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("awaiting_correction");
    expect(result.conflict.message).toContain("CFO");
  });

  it("still allows a resubmit while a correction is outstanding", () => {
    expect(
      evaluateApprovalAction(
        snapshot({ approvalStatus: "correction_requested" }),
        "resubmitted",
        "Drafter",
      ).ok,
    ).toBe(true);
  });

  it("catches the same reviewer re-deciding in one session", () => {
    const result = evaluateApprovalAction(
      snapshot({
        approvalHistory: [
          { approvedBy: "CFO", approvedAt: "2026-09-28T10:00:00Z", action: "approved" },
        ],
      }),
      "approved",
      "CFO",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("already_decided_by_you");
  });

  it("handles a payroll that is no longer in the queue", () => {
    const result = evaluateApprovalAction(null, "approved", "A", false);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("not_found");
    expect(result.conflict.message).toMatch(/no longer in the approval queue/i);
  });

  it("treats a history with no decision entries as still pending", () => {
    expect(evaluateApprovalAction(snapshot({ approvalHistory: [] }), "approved", "A").ok).toBe(
      true,
    );
    expect(evaluateApprovalAction(snapshot({ approvalHistory: undefined }), "approved", "A").ok).toBe(
      true,
    );
  });

  it("ignores resubmit entries when looking for the last real decision", () => {
    // After a resubmit the top of the history is a "resubmitted" row, but the
    // decision that put it in correction_requested is still the relevant one.
    const result = evaluateApprovalAction(
      snapshot({
        approvalStatus: "correction_requested",
        approvalHistory: [
          { approvedBy: "CFO", approvedAt: "2026-09-28T09:00:00Z", action: "correction_requested" },
          { approvedBy: "Drafter", approvedAt: "2026-09-28T09:30:00Z", action: "resubmitted" },
        ],
      }),
      "approved",
      "Second Exec",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.conflictingReviewer).toBe("CFO");
  });

  it("never leaks payroll values into a conflict message", () => {
    const result = evaluateApprovalAction(
      snapshot({
        approvalStatus: "approved",
        approvalHistory: [
          { approvedBy: "CFO", approvedAt: "2026-09-28T10:00:00Z", action: "approved" },
        ],
      }),
      "approved",
      "Second Exec",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The store's seed rows carry totalAmount/employeeCount/notes; none of
    // that may reach the reviewer-facing string.
    expect(result.conflict.message).not.toMatch(/\$|145000|88000|employeeCount|bonus/i);
  });
});

describe("approvalStatusLabel", () => {
  it("labels every approval state", () => {
    expect(approvalStatusLabel("pending_executive_approval")).toBe("Pending executive approval");
    expect(approvalStatusLabel("approved")).toBe("Approved");
    expect(approvalStatusLabel("rejected")).toBe("Rejected");
    expect(approvalStatusLabel("correction_requested")).toBe("Correction requested");
  });
});

describe("approvalQueue store — guarded actions (#552)", () => {
  const ID = "draft_exec_001";

  beforeEach(() => {
    // Reset to the seed so each test starts from a known pending row.
    useApprovalQueueStore.setState({
      drafts: [
        {
          id: ID,
          companyId: "company_001",
          timestamp: "2026-09-28T10:00:00Z",
          createdAt: "2026-09-28T10:00:00Z",
          totalAmount: 145000,
          employeeCount: 18,
          proof: "0xproof",
          status: "pending",
          approvalStatus: "pending_executive_approval",
          requiresExecutiveReview: true,
          employeeIds: ["emp_001"],
          executedAt: null,
          transactionHash: null,
          notes: "Q3 bonus",
          approvalHistory: [],
        },
      ],
    });
  });

  const row = () => useApprovalQueueStore.getState().drafts[0];

  it("applies a valid approval", () => {
    const result = useApprovalQueueStore
      .getState()
      .approveDraft(ID, "CFO", "Finance Director", "ok");
    expect(result.ok).toBe(true);
    expect(row().approvalStatus).toBe("approved");
  });

  it("does not let a stale second approval overwrite the first", () => {
    useApprovalQueueStore.getState().approveDraft(ID, "CFO", "Finance Director");
    const second = useApprovalQueueStore
      .getState()
      .approveDraft(ID, "Second Exec", "Admin");

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.conflict.reason).toBe("already_approved");
    // The row is untouched — no duplicate history entry.
    expect(row().approvalHistory).toHaveLength(1);
    expect(row().approvalHistory?.[0].approvedBy).toBe("CFO");
  });

  it("does not let a stale reject cancel an approved payroll", () => {
    useApprovalQueueStore.getState().approveDraft(ID, "CFO", "Finance Director");
    const stale = useApprovalQueueStore.getState().rejectDraft(ID, "Second Exec", "Admin");

    expect(stale.ok).toBe(false);
    // The regression that mattered: status must not flip to cancelled.
    expect(row().approvalStatus).toBe("approved");
    expect(row().status).toBe("pending");
  });

  it("reports a conflict for a payroll that is no longer queued", () => {
    const result = useApprovalQueueStore.getState().approveDraft("nope", "CFO", "FD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("not_found");
  });

  it("leaves state unchanged on every refused action", () => {
    useApprovalQueueStore.getState().approveDraft(ID, "CFO", "Finance Director");
    const before = JSON.stringify(useApprovalQueueStore.getState().drafts);

    useApprovalQueueStore.getState().rejectDraft(ID, "B", "Admin");
    useApprovalQueueStore.getState().requestCorrection(ID, "B", "Admin", "fix");
    useApprovalQueueStore.getState().resubmitDraft(ID, "D", "Operator");

    expect(JSON.stringify(useApprovalQueueStore.getState().drafts)).toBe(before);
  });
});

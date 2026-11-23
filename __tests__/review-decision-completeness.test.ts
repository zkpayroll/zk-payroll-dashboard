import { describe, it, expect, beforeEach } from "vitest";
import {
  requiresDecisionReason,
  hasDecisionReason,
  missingDecisionReasonConflict,
  type ApprovalSnapshot,
} from "@/lib/payroll/approvalConflict";
import { useApprovalQueueStore } from "@/stores/approvalQueue";
import { usePayrollPolicyStore, DEFAULT_PAYROLL_POLICY } from "@/stores/payrollPolicy";
import { useTreasuryStore } from "@/stores/treasury";

// Review decision completeness (#684).
//
// `rejectDraft` and `requestCorrection` record a reviewer's comment into
// `approvalHistory`, but neither previously verified it was non-empty at
// runtime — a rejection or correction request could be recorded with no
// rationale at all, leaving the drafter with a decision but nothing to act
// on. These tests cover the pure helpers in `approvalConflict.ts` and the
// store wiring that refuses an incomplete decision.

function snapshot(over: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot {
  return { approvalStatus: "pending_executive_approval", approvalHistory: [], ...over };
}

describe("requiresDecisionReason", () => {
  it("requires a reason for rejections and correction requests", () => {
    expect(requiresDecisionReason("rejected")).toBe(true);
    expect(requiresDecisionReason("correction_requested")).toBe(true);
  });

  it("does not require a reason for approvals or resubmissions", () => {
    expect(requiresDecisionReason("approved")).toBe(false);
    expect(requiresDecisionReason("resubmitted")).toBe(false);
  });
});

describe("hasDecisionReason", () => {
  it("accepts a non-empty, trimmed comment (success path)", () => {
    expect(hasDecisionReason("Missing timesheet for contractor rate")).toBe(true);
    expect(hasDecisionReason("  fix the amount  ")).toBe(true);
  });

  it("rejects undefined, empty, and whitespace-only comments (failure path)", () => {
    expect(hasDecisionReason(undefined)).toBe(false);
    expect(hasDecisionReason("")).toBe(false);
    expect(hasDecisionReason("   ")).toBe(false);
    expect(hasDecisionReason("\n\t")).toBe(false);
  });
});

describe("missingDecisionReasonConflict", () => {
  it("builds a conflict naming the attempted action, free of payroll values", () => {
    const result = missingDecisionReasonConflict(snapshot(), "rejected");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("missing_decision_reason");
    expect(result.conflict.attemptedAction).toBe("rejected");
    expect(result.conflict.message).toMatch(/reason is required/i);
    expect(result.conflict.message).not.toMatch(/\$|amount|salary/i);
  });
});

describe("approvalQueue store — decision completeness (#684)", () => {
  const ID = "draft_exec_001";

  beforeEach(() => {
    usePayrollPolicyStore.setState({
      policy: {
        ...JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY)),
        approvals: {
          requiredApprovalsCount: 1,
          requireDualApproval: false,
          dualApprovalThreshold: 50000,
          allowSelfApproval: false,
          requireAuditorApproval: true,
        },
      },
    });
    useTreasuryStore.setState({
      balances: { USDC: { assetCode: "USDC", available: 500000, reserved: 0, projected: 0 } },
      obligations: [],
    });
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

  it("refuses a rejection with no comment and writes nothing (failure path)", () => {
    const result = useApprovalQueueStore.getState().rejectDraft(ID, "CFO", "Finance Director");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("missing_decision_reason");
    expect(row().approvalStatus).toBe("pending_executive_approval");
    expect(row().approvalHistory).toHaveLength(0);
  });

  it("refuses a rejection with a whitespace-only comment (failure path)", () => {
    const result = useApprovalQueueStore.getState().rejectDraft(ID, "CFO", "Finance Director", "   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("missing_decision_reason");
    expect(row().approvalHistory).toHaveLength(0);
  });

  it("accepts a rejection with a real reason (success path)", () => {
    const result = useApprovalQueueStore
      .getState()
      .rejectDraft(ID, "CFO", "Finance Director", "Duplicate run — already processed in batch 882.");
    expect(result.ok).toBe(true);
    expect(row().approvalStatus).toBe("rejected");
    expect(row().approvalHistory?.[0].comment).toBe("Duplicate run — already processed in batch 882.");
  });

  it("refuses a correction request with no comment and writes nothing (failure path)", () => {
    // An empty string still satisfies the `comment: string` signature at
    // compile time — this is exactly the gap the runtime guard closes.
    const result = useApprovalQueueStore.getState().requestCorrection(ID, "CFO", "Finance Director", "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.conflict.reason).toBe("missing_decision_reason");
    expect(row().approvalStatus).toBe("pending_executive_approval");
    expect(row().approvalHistory).toHaveLength(0);
  });

  it("accepts a correction request with a real reason (success path)", () => {
    const result = useApprovalQueueStore
      .getState()
      .requestCorrection(ID, "CFO", "Finance Director", "Please re-confirm employee count before resubmitting.");
    expect(result.ok).toBe(true);
    expect(row().approvalStatus).toBe("correction_requested");
  });

  it("a stale rejection (already approved by someone else) surfaces the state conflict, not a missing-reason error, even with no comment", () => {
    useApprovalQueueStore.getState().approveDraft(ID, "CFO", "Finance Director", "approved");
    const result = useApprovalQueueStore.getState().rejectDraft(ID, "Second Exec", "Admin");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The real problem here is the stale state, not the missing reason.
    expect(result.conflict.reason).toBe("already_approved");
  });

  it("approving still works with no comment (approvals are exempt from the completeness rule)", () => {
    const result = useApprovalQueueStore.getState().approveDraft(ID, "CFO", "Finance Director");
    expect(result.ok).toBe(true);
    expect(row().approvalStatus).toBe("approved");
  });
});

/**
 * Rejected correction events in payroll history (#844).
 *
 * Covers:
 *  - Success: a run rejected after a correction request is surfaced
 *  - Rejection without a prior correction request is NOT a correction event
 *  - Boundary: multiple correction rounds, out-of-order / invalid timestamps,
 *    legacy rejection with no reason
 *  - Privacy: amounts, notes and employee ids never render; sensitive
 *    reviewer reasons are withheld
 *  - End-to-end through the approval queue store
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  getRejectedCorrectionEvents,
  MISSING_REASON_COPY,
  WITHHELD_REASON_COPY,
  type RejectedCorrectionSource,
} from "@/lib/payroll/rejectedCorrections";
import { RejectedCorrectionHistory } from "@/components/features/payroll/RejectedCorrectionHistory";
import { useApprovalQueueStore, type ApprovalDraft } from "@/stores/approvalQueue";

function draft(
  id: string,
  approvalHistory: NonNullable<RejectedCorrectionSource["approvalHistory"]>,
): RejectedCorrectionSource {
  return { id, approvalStatus: "rejected", approvalHistory };
}

const correctionThenReject = draft("run_rc_001", [
  { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Fix the period dates", action: "correction_requested" },
  { approvedBy: "Drafter", approvedAt: "2026-10-02T09:00:00Z", role: "Operator", comment: "Dates fixed", action: "resubmitted" },
  { approvedBy: "Exec B", approvedAt: "2026-10-03T09:00:00Z", role: "Admin", comment: "Wrong cost centre still attached", action: "rejected" },
]);

describe("getRejectedCorrectionEvents", () => {
  it("returns an event for a run rejected after a correction request (success)", () => {
    const [event, ...rest] = getRejectedCorrectionEvents([correctionThenReject]);
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      id: "run_rc_001:rejected:2026-10-03T09:00:00Z",
      payrollRunId: "run_rc_001",
      rejectedBy: "Exec B",
      rejectedByRole: "Admin",
      correctionRounds: 1,
      lastCorrectionRequestedAt: "2026-10-01T09:00:00Z",
      resubmittedBeforeRejection: true,
      reason: "Wrong cost centre still attached",
      reasonWithheld: false,
    });
  });

  it("ignores rejections that were never preceded by a correction request", () => {
    const plain = draft("run_plain", [
      { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Not this quarter", action: "rejected" },
    ]);
    const pending = { id: "run_pending", approvalStatus: "pending_executive_approval", approvalHistory: [] };
    expect(getRejectedCorrectionEvents([plain, pending, { id: "run_no_history" }])).toEqual([]);
  });

  it("does not count a correction request issued after the rejection", () => {
    const late = draft("run_late", [
      { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "No", action: "rejected" },
      { approvedBy: "Exec A", approvedAt: "2026-10-02T09:00:00Z", role: "Admin", comment: "Fix", action: "correction_requested" },
    ]);
    expect(getRejectedCorrectionEvents([late])).toEqual([]);
  });

  it("orders history by timestamp and counts every correction round (boundary)", () => {
    const multi = draft("run_multi", [
      // Deliberately out of recorded order.
      { approvedBy: "Exec A", approvedAt: "2026-10-05T09:00:00Z", role: "Admin", comment: "Still wrong", action: "rejected" },
      { approvedBy: "Exec A", approvedAt: "2026-10-03T09:00:00Z", role: "Admin", comment: "Round two", action: "correction_requested" },
      { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Round one", action: "correction_requested" },
      { approvedBy: "Drafter", approvedAt: "2026-10-02T09:00:00Z", role: "Operator", action: "resubmitted" },
      { approvedBy: "Exec A", approvedAt: "not-a-date", role: "Admin", action: "correction_requested" },
    ]);
    const [event] = getRejectedCorrectionEvents([multi]);
    expect(event.correctionRounds).toBe(2);
    expect(event.lastCorrectionRequestedAt).toBe("2026-10-03T09:00:00Z");
    // The resubmission answered round one, not round two.
    expect(event.resubmittedBeforeRejection).toBe(false);
  });

  it("returns events newest first across runs", () => {
    const older = draft("run_old", [
      { approvedBy: "Exec A", approvedAt: "2026-09-01T09:00:00Z", role: "Admin", comment: "Fix", action: "correction_requested" },
      { approvedBy: "Exec A", approvedAt: "2026-09-02T09:00:00Z", role: "Admin", comment: "No", action: "rejected" },
    ]);
    expect(getRejectedCorrectionEvents([older, correctionThenReject]).map((e) => e.payrollRunId)).toEqual([
      "run_rc_001",
      "run_old",
    ]);
  });

  it("withholds reasons that mention amounts, employee data or credentials", () => {
    for (const comment of ["Total of $145,000 is too high", "emp_003 should be removed", "send the private key"]) {
      const d = draft("run_sensitive", [
        { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Fix", action: "correction_requested" },
        { approvedBy: "Exec A", approvedAt: "2026-10-02T09:00:00Z", role: "Admin", comment, action: "rejected" },
      ]);
      const [event] = getRejectedCorrectionEvents([d]);
      expect(event.reason).toBeNull();
      expect(event.reasonWithheld).toBe(true);
      expect(JSON.stringify(event)).not.toContain(comment);
    }
  });

  it("treats a blank reason as missing, not withheld", () => {
    const d = draft("run_blank", [
      { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Fix", action: "correction_requested" },
      { approvedBy: "Exec A", approvedAt: "2026-10-02T09:00:00Z", role: "Admin", comment: "   ", action: "rejected" },
    ]);
    const [event] = getRejectedCorrectionEvents([d]);
    expect(event).toMatchObject({ reason: null, reasonWithheld: false });
  });
});

// ─── Component ────────────────────────────────────────────────────────────────

const baseDraft: ApprovalDraft = {
  id: "draft_rc_ui",
  companyId: "company_001",
  timestamp: "2026-10-01T00:00:00Z",
  createdAt: "2026-10-01T00:00:00Z",
  totalAmount: 145000,
  employeeCount: 18,
  proof: "0xproof",
  status: "pending",
  approvalStatus: "pending_executive_approval",
  requiresExecutiveReview: true,
  employeeIds: ["emp_001", "emp_002"],
  executedAt: null,
  transactionHash: null,
  notes: "Q3 Executive bonus payroll run ($145,000)",
  approvalHistory: [],
};

describe("RejectedCorrectionHistory", () => {
  beforeEach(() => {
    useApprovalQueueStore.setState({ drafts: [] });
  });

  it("renders an empty state when nothing has been rejected after correction", () => {
    useApprovalQueueStore.setState({ drafts: [baseDraft] });
    render(<RejectedCorrectionHistory />);
    expect(screen.getByText(/no rejected corrections/i)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /rejected correction events/i })).not.toBeInTheDocument();
  });

  it("surfaces a correction that was resubmitted and then rejected via the store (end-to-end)", () => {
    useApprovalQueueStore.setState({ drafts: [baseDraft] });
    const store = useApprovalQueueStore.getState();

    expect(store.requestCorrection(baseDraft.id, "Exec A", "Admin", "Fix the period dates").ok).toBe(true);
    expect(useApprovalQueueStore.getState().resubmitDraft(baseDraft.id, "Drafter", "Operator").ok).toBe(true);
    expect(
      // A second executive: the approval gate blocks the requester from also deciding.
      useApprovalQueueStore.getState().rejectDraft(baseDraft.id, "Exec B", "Admin", "Cost centre is still wrong").ok,
    ).toBe(true);

    const { container } = render(<RejectedCorrectionHistory />);

    const list = screen.getByRole("list", { name: /rejected correction events/i });
    const rows = within(list).getAllByTestId("rejected-correction-event");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("draft_rc_ui")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Cost centre is still wrong")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/1 correction round/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/rejected after resubmission/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be resubmitted/i)).toBeInTheDocument();

    // Private payroll data never renders.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/145,?000/);
    expect(text).not.toContain("emp_001");
    expect(text).not.toContain("Q3 Executive bonus");
  });

  it("does not show an event when the rejection is refused by the approval gate (rejection path)", () => {
    useApprovalQueueStore.setState({ drafts: [baseDraft] });
    useApprovalQueueStore.getState().requestCorrection(baseDraft.id, "Exec A", "Admin", "Fix the period dates");

    // Rejecting while still awaiting corrections is a conflict; nothing is written.
    const result = useApprovalQueueStore.getState().rejectDraft(baseDraft.id, "Exec B", "Admin", "No");
    expect(result.ok).toBe(false);

    render(<RejectedCorrectionHistory />);
    expect(screen.getByText(/no rejected corrections/i)).toBeInTheDocument();
  });

  it("shows actionable copy instead of withheld or missing reasons", () => {
    const history = (comment?: string): ApprovalDraft["approvalHistory"] => [
      { approvedBy: "Exec A", approvedAt: "2026-10-01T09:00:00Z", role: "Admin", comment: "Fix", action: "correction_requested" },
      { approvedBy: "Exec A", approvedAt: "2026-10-02T09:00:00Z", role: "Admin", comment, action: "rejected" },
    ];
    useApprovalQueueStore.setState({
      drafts: [
        { ...baseDraft, id: "run_withheld", approvalStatus: "rejected", approvalHistory: history("Salary of 9000 USDC is wrong") },
        { ...baseDraft, id: "run_missing", approvalStatus: "rejected", approvalHistory: history(undefined) },
      ],
    });

    const { container } = render(<RejectedCorrectionHistory />);
    expect(screen.getByText(WITHHELD_REASON_COPY)).toBeInTheDocument();
    expect(screen.getByText(MISSING_REASON_COPY)).toBeInTheDocument();
    expect(container.textContent).not.toContain("9000");
  });
});

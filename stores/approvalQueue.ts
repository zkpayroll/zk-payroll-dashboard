"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollRun } from "@/types/models";
import {
  evaluateApprovalAction,
  approvalsRecorded,
  requiredApprovalsFor,
  insufficientTreasuryConflict,
  requiresDecisionReason,
  hasDecisionReason,
  missingDecisionReasonConflict,
  type ApprovalAction,
  type ApprovalActionResult,
} from "@/lib/payroll/approvalConflict";
import { usePayrollPolicyStore } from "@/stores/payrollPolicy";
import { useTreasuryStore, type AssetCode } from "@/stores/treasury";
import { checkTreasuryReservation } from "@/lib/treasury/reservations";

/**
 * Approval-queue payroll runs don't carry a per-run `assetCode` (unlike the
 * multi-asset payroll flow in `lib/payroll/multiAsset.ts`); `totalAmount` is
 * always denominated in the treasury's default settlement asset (#666).
 */
const APPROVAL_QUEUE_ASSET: AssetCode = "USDC";

export interface ApprovalDraft extends PayrollRun {
  approvalStatus:
    | "pending_executive_approval"
    | "approved"
    | "rejected"
    | "correction_requested";
  requiresExecutiveReview: boolean;
  notes?: string;
  correctionExpiresAt?: string;
  /** Distinct approvals required before quorum is met (#664); set on first approve. */
  requiredApprovals?: number;
}

export const CORRECTION_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ApprovalQueueState {
  drafts: ApprovalDraft[];
  approveDraft: (id: string, reviewerName: string, role: string, comment?: string) => ApprovalActionResult;
  rejectDraft: (id: string, reviewerName: string, role: string, comment?: string) => ApprovalActionResult;
  /** Comment is required — it tells the drafter exactly what to fix. */
  requestCorrection: (id: string, reviewerName: string, role: string, comment: string) => ApprovalActionResult;
  /** Simulates the drafter addressing feedback and putting the draft back in the queue. */
  resubmitDraft: (id: string, submitterName: string, role: string, comment?: string) => ApprovalActionResult;
  addDraftForApproval: (draft: PayrollRun, notes?: string) => void;
}

/**
 * Builds one of the four guarded mutations (#552).
 *
 * The gate is the whole point: every action used to be an unguarded
 * `drafts.map` that matched on id and overwrote `approvalStatus`, so a second
 * executive acting on a stale view of the queue silently discarded the first
 * decision. Now a decision that does not match the state the reviewer saw is
 * refused, nothing is written, and the caller gets a message naming the state
 * and who got there first — no payroll values.
 */
function guardedUpdate(
  drafts: ApprovalDraft[],
  id: string,
  reviewerName: string,
  role: string,
  action: ApprovalAction,
  apply: (draft: ApprovalDraft, decidedAt: string) => ApprovalDraft,
): { drafts: ApprovalDraft[]; result: ApprovalActionResult } {
  const target = drafts.find((d) => d.id === id);
  const result = evaluateApprovalAction(
    target,
    action,
    reviewerName,
    /* draftExists */ Boolean(target),
  );
  if (!result.ok) return { drafts, result };

  const decidedAt = new Date().toISOString();
  return {
    drafts: drafts.map((d) => (d.id === id ? apply(d, decidedAt) : d)),
    result,
  };
}

const INITIAL_APPROVAL_DRAFTS: ApprovalDraft[] = [
  {
    id: "draft_exec_001",
    companyId: "company_001",
    timestamp: "2026-07-29T10:00:00Z",
    createdAt: "2026-07-29T10:00:00Z",
    totalAmount: 145000,
    employeeCount: 18,
    proof: "0xzkproof_exec_145k",
    status: "pending",
    approvalStatus: "pending_executive_approval",
    requiresExecutiveReview: true,
    employeeIds: ["emp_001", "emp_002", "emp_003", "emp_004", "emp_005"],
    executedAt: null,
    transactionHash: null,
    notes: "Q3 Executive bonus & high-value engineering payroll run ($145,000)",
    approvalHistory: [],
  },
  {
    id: "draft_exec_002",
    companyId: "company_001",
    timestamp: "2026-07-28T14:30:00Z",
    createdAt: "2026-07-28T14:30:00Z",
    totalAmount: 88000,
    employeeCount: 12,
    proof: "0xzkproof_exec_88k",
    status: "pending",
    approvalStatus: "pending_executive_approval",
    requiresExecutiveReview: true,
    employeeIds: ["emp_001", "emp_002"],
    executedAt: null,
    transactionHash: null,
    notes: "Mid-year operational expansion payroll batch",
    approvalHistory: [],
  },
];

export const useApprovalQueueStore = create<ApprovalQueueState>()(
  persist(
    (set, get) => ({
      drafts: INITIAL_APPROVAL_DRAFTS,
      approveDraft: (id, reviewerName, role, comment) => {
        // Treasury reservation check (#666) happens *before* the guarded
        // state transition: if this approval would reach quorum and release
        // more funds than the treasury actually has available (net of what
        // other in-flight runs already reserved), the approval is refused
        // outright — the draft's approvalHistory is not touched, so the
        // reviewer can retry once the conflict is resolved (top up, or wait
        // for another run to release its reservation).
        const target = get().drafts.find((d) => d.id === id);
        if (target) {
          const existingApprovals = approvalsRecorded(target).length;
          const wouldReachQuorum =
            target.approvalStatus === "pending_executive_approval" &&
            !approvalsRecorded(target).includes(reviewerName) &&
            existingApprovals + 1 >=
              requiredApprovalsFor({
                requiredApprovalsCount: usePayrollPolicyStore.getState().policy.approvals.requiredApprovalsCount,
                requireDualApproval: usePayrollPolicyStore.getState().policy.approvals.requireDualApproval,
                dualApprovalThreshold: usePayrollPolicyStore.getState().policy.approvals.dualApprovalThreshold,
                totalAmount: target.totalAmount,
              });
          if (wouldReachQuorum) {
            const balance = useTreasuryStore.getState().balances[APPROVAL_QUEUE_ASSET];
            const reservationCheck = checkTreasuryReservation(balance, APPROVAL_QUEUE_ASSET, target.totalAmount);
            if (!reservationCheck.ok) {
              return insufficientTreasuryConflict(target, reservationCheck.reason!);
            }
          }
        }

        const { drafts, result } = guardedUpdate(
          get().drafts, id, reviewerName, role, "approved",
          (d, at) => {
            const history = [
              ...(d.approvalHistory || []),
              { approvedBy: reviewerName, approvedAt: at, role, comment, action: "approved" as const },
            ];
            // Quorum gate (#664): the draft only moves out of executive
            // review once enough *distinct* reviewers have approved it. A
            // high-value run (>= dualApprovalThreshold) needs at least two,
            // per org policy — a single "Approve" click can no longer
            // release a $145k batch on its own.
            const quorum = requiredApprovalsFor({
              requiredApprovalsCount: usePayrollPolicyStore.getState().policy.approvals.requiredApprovalsCount,
              requireDualApproval: usePayrollPolicyStore.getState().policy.approvals.requireDualApproval,
              dualApprovalThreshold: usePayrollPolicyStore.getState().policy.approvals.dualApprovalThreshold,
              totalAmount: d.totalAmount,
            });
            const distinctApprovals = approvalsRecorded({ approvalStatus: d.approvalStatus, approvalHistory: history }).length;
            const quorumMet = distinctApprovals >= quorum;
            return {
              ...d,
              approvalStatus: quorumMet ? "approved" : "pending_executive_approval",
              status: "pending",
              requiredApprovals: quorum,
              approvalHistory: history,
            };
          },
        );
        if (result.ok) {
          set({ drafts });
          // Reserve the funds (#666) only once quorum was actually reached
          // by this call — a vote that leaves the draft still pending
          // doesn't commit treasury funds yet.
          const updatedDraft = drafts.find((d) => d.id === id);
          if (updatedDraft?.approvalStatus === "approved" && target?.approvalStatus !== "approved") {
            useTreasuryStore.getState().reserveForPayroll(APPROVAL_QUEUE_ASSET, updatedDraft.totalAmount, {
              id: `approval_${updatedDraft.id}`,
              name: updatedDraft.notes || `Payroll run ${updatedDraft.id}`,
              amount: updatedDraft.totalAmount,
              assetCode: APPROVAL_QUEUE_ASSET,
              scheduledDate: new Date().toISOString(),
              lockedAt: new Date().toISOString(),
            });
          }
        }
        return result;
      },
      rejectDraft: (id, reviewerName, role, comment) => {
        const target = get().drafts.find((d) => d.id === id);
        // Decision completeness (#684): a rejection without a reason leaves
        // the drafter with nothing to act on. This is checked only once the
        // action is otherwise legal against the draft's current state — a
        // stale/conflicting reject (e.g. the draft was already approved by
        // someone else) must still surface as *that* conflict, not a missing
        // reason, so the state check runs first via `evaluateApprovalAction`.
        if (
          target &&
          requiresDecisionReason("rejected") &&
          !hasDecisionReason(comment) &&
          evaluateApprovalAction(target, "rejected", reviewerName, true).ok
        ) {
          return missingDecisionReasonConflict(target, "rejected");
        }
        const { drafts, result } = guardedUpdate(
          get().drafts, id, reviewerName, role, "rejected",
          (d, at) => ({
            ...d,
            approvalStatus: "rejected",
            status: "cancelled",
            approvalHistory: [
              ...(d.approvalHistory || []),
              { approvedBy: reviewerName, approvedAt: at, role, comment, action: "rejected" },
            ],
          }),
        );
        if (result.ok) {
          set({ drafts });
          // Release any treasury reservation held by this draft (#666). A
          // draft only ever reserves funds once it reaches "approved", so
          // this is a no-op for the common case of rejecting a still-pending
          // draft — but a previously-approved draft that gets corrected and
          // re-enters review, then rejected, must give its hold back.
          if (target?.approvalStatus === "approved") {
            const obligationId = `approval_${id}`;
            const balance = useTreasuryStore.getState().balances[APPROVAL_QUEUE_ASSET];
            const hasMatchingObligation = useTreasuryStore
              .getState()
              .obligations.some((o) => o.id === obligationId);
            if (balance && hasMatchingObligation) {
              useTreasuryStore.getState().releaseReservation(APPROVAL_QUEUE_ASSET, target.totalAmount, obligationId);
            }
          }
        }
        return result;
      },
      requestCorrection: (id, reviewerName, role, comment) => {
        const target = get().drafts.find((d) => d.id === id);
        // Decision completeness (#684): correction requests already type
        // `comment` as required, but nothing previously enforced it at
        // runtime — a caller (e.g. a future API route, or a test) could
        // still pass an empty string straight through to approvalHistory.
        // As with reject, a stale/conflicting request must surface as that
        // conflict rather than a missing-reason error.
        if (
          target &&
          requiresDecisionReason("correction_requested") &&
          !hasDecisionReason(comment) &&
          evaluateApprovalAction(target, "correction_requested", reviewerName, true).ok
        ) {
          return missingDecisionReasonConflict(target, "correction_requested");
        }
        const { drafts, result } = guardedUpdate(
          get().drafts, id, reviewerName, role, "correction_requested",
          // Correction requests keep the run in "pending" (not cancelled) since
          // the drafter is expected to fix and resubmit rather than start over.
          (d, at) => ({
            ...d,
            approvalStatus: "correction_requested",
            correctionExpiresAt: new Date(new Date(at).getTime() + CORRECTION_REQUEST_TTL_MS).toISOString(),
            status: "pending",
            approvalHistory: [
              ...(d.approvalHistory || []),
              { approvedBy: reviewerName, approvedAt: at, role, comment, action: "correction_requested" },
            ],
          }),
        );
        if (result.ok) set({ drafts });
        return result;
      },
      resubmitDraft: (id, submitterName, role, comment) => {
        const draft = get().drafts.find((item) => item.id === id);
        const correctionRequestedAt = draft?.approvalHistory
          ?.slice()
          .reverse()
          .find((entry) => entry.action === "correction_requested")?.approvedAt;
        const correctionExpiresAt = draft?.correctionExpiresAt || (correctionRequestedAt
          ? new Date(new Date(correctionRequestedAt).getTime() + CORRECTION_REQUEST_TTL_MS).toISOString()
          : undefined);
        if (
          draft?.approvalStatus === "correction_requested" &&
          correctionExpiresAt &&
          new Date(correctionExpiresAt).getTime() <= Date.now()
        ) {
          return {
            ok: false,
            conflict: {
              reason: "correction_expired",
              currentStatus: "correction_requested",
              currentStatusLabel: "Correction request expired",
              attemptedAction: "resubmitted",
              decidedAt: correctionExpiresAt,
              message: "The correction request has expired. Ask an executive to review the payroll and issue a new correction request.",
            },
          };
        }
        const { drafts, result } = guardedUpdate(
          get().drafts, id, submitterName, role, "resubmitted",
          (d, at) => ({
            ...d,
            approvalStatus: "pending_executive_approval",
            status: "pending",
            approvalHistory: [
              ...(d.approvalHistory || []),
              {
                approvedBy: submitterName,
                approvedAt: at,
                role,
                comment: comment || "Corrections addressed; resubmitted for review",
                action: "resubmitted",
              },
            ],
          }),
        );
        if (result.ok) set({ drafts });
        return result;
      },
      addDraftForApproval: (draft, notes) =>
        set((state) => ({
          drafts: [
            ...state.drafts,
            {
              ...draft,
              approvalStatus: "pending_executive_approval",
              requiresExecutiveReview: true,
              notes,
              approvalHistory: [],
            },
          ],
        })),
    }),
    {
      name: "zk_approval_queue_store",
    },
  ),
);

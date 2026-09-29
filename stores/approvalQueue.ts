"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollRun } from "@/types/models";
import {
  evaluateApprovalAction,
  type ApprovalAction,
  type ApprovalActionResult,
} from "@/lib/payroll/approvalConflict";

export interface ApprovalDraft extends PayrollRun {
  approvalStatus:
    | "pending_executive_approval"
    | "approved"
    | "rejected"
    | "correction_requested";
  requiresExecutiveReview: boolean;
  notes?: string;
  correctionExpiresAt?: string;
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
        const { drafts, result } = guardedUpdate(
          get().drafts, id, reviewerName, role, "approved",
          (d, at) => ({
            ...d,
            approvalStatus: "approved",
            status: "pending",
            approvalHistory: [
              ...(d.approvalHistory || []),
              { approvedBy: reviewerName, approvedAt: at, role, comment, action: "approved" },
            ],
          }),
        );
        if (result.ok) set({ drafts });
        return result;
      },
      rejectDraft: (id, reviewerName, role, comment) => {
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
        if (result.ok) set({ drafts });
        return result;
      },
      requestCorrection: (id, reviewerName, role, comment) => {
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

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollRun } from "@/types/models";

export interface ApprovalDraft extends PayrollRun {
  approvalStatus: "pending_executive_approval" | "approved" | "rejected";
  requiresExecutiveReview: boolean;
  notes?: string;
}

interface ApprovalQueueState {
  drafts: ApprovalDraft[];
  approveDraft: (id: string, reviewerName: string, role: string, comment?: string) => void;
  rejectDraft: (id: string, reviewerName: string, role: string, comment?: string) => void;
  addDraftForApproval: (draft: PayrollRun, notes?: string) => void;
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
    (set) => ({
      drafts: INITIAL_APPROVAL_DRAFTS,
      approveDraft: (id, reviewerName, role, comment) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? {
                  ...d,
                  approvalStatus: "approved",
                  status: "pending",
                  approvalHistory: [
                    ...(d.approvalHistory || []),
                    {
                      approvedBy: reviewerName,
                      approvedAt: new Date().toISOString(),
                      role,
                      comment,
                    },
                  ],
                }
              : d,
          ),
        })),
      rejectDraft: (id, reviewerName, role, comment) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? {
                  ...d,
                  approvalStatus: "rejected",
                  status: "cancelled",
                  approvalHistory: [
                    ...(d.approvalHistory || []),
                    {
                      approvedBy: reviewerName,
                      approvedAt: new Date().toISOString(),
                      role,
                      comment,
                    },
                  ],
                }
              : d,
          ),
        })),
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

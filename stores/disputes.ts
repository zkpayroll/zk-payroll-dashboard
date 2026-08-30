import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollDispute, DisputeStatus, UserRole } from "@/types";

const MOCK_DISPUTES: PayrollDispute[] = [
  {
    id: "disp_001",
    payrollPeriod: "2026-Q3-July",
    payrollBatch: "batch_exec_001",
    status: "active",
    resolutionDeadline: "2026-08-30T23:59:59Z",
    safeReasonCode: "compliance_hold",
    safeReasonDescription: "Compliance review required before finalization — flagged by automated compliance check.",
    blockedActions: ["finalization", "reconciliation"],
    requiredReviewer: "admin",
    resolutionAction: "Complete compliance review and clear the hold to allow finalization.",
    createdAt: "2026-08-20T09:00:00Z",
  },
  {
    id: "disp_002",
    payrollPeriod: "2026-Q3-August",
    payrollBatch: "batch_exec_002",
    status: "overdue",
    resolutionDeadline: "2026-08-20T23:59:59Z",
    safeReasonCode: "pending_approval",
    safeReasonDescription: "Awaiting executive approval — payroll batch is locked pending sign-off.",
    blockedActions: ["execution"],
    requiredReviewer: "admin",
    resolutionAction: "Approve or reject the pending executive approval to unblock execution.",
    createdAt: "2026-08-10T14:30:00Z",
  },
  {
    id: "disp_003",
    payrollPeriod: "2026-Q2-June",
    payrollBatch: "batch_exec_003",
    status: "resolved",
    resolutionDeadline: "2026-07-15T23:59:59Z",
    safeReasonCode: "zk_proof_failed",
    safeReasonDescription: "ZK proof verification failed — proof has been regenerated and verified.",
    blockedActions: [],
    requiredReviewer: "admin",
    resolutionAction: "Proof regenerated and verified successfully.",
    createdAt: "2026-07-01T10:00:00Z",
    resolvedAt: "2026-07-12T16:45:00Z",
    resolvedBy: "admin_alice",
    resolutionNote: "ZK proof was regenerated for all employees in the batch. Re-verification passed on-chain.",
  },
  {
    id: "disp_004",
    payrollPeriod: "2026-Q3-August",
    payrollBatch: "batch_exec_004",
    status: "active",
    resolutionDeadline: "2026-09-05T23:59:59Z",
    safeReasonCode: "employee_data_changed",
    safeReasonDescription: "Employee salary commitment mismatch detected — commitment must be updated before approval.",
    blockedActions: ["approval", "execution"],
    requiredReviewer: "operator",
    resolutionAction: "Update the affected employee salary commitment to match the new salary.",
    createdAt: "2026-08-22T08:15:00Z",
  },
  {
    id: "disp_005",
    payrollPeriod: "2026-Q3-July",
    payrollBatch: "batch_exec_001",
    status: "escalated",
    resolutionDeadline: "2026-08-25T23:59:59Z",
    safeReasonCode: "insufficient_treasury",
    safeReasonDescription: "Treasury balance insufficient to cover the full payroll batch — funding gap detected.",
    blockedActions: ["finalization", "execution", "reconciliation"],
    requiredReviewer: "admin",
    resolutionAction: "Fund the treasury account or reduce the batch to cover available balance.",
    createdAt: "2026-08-18T11:30:00Z",
  },
];

const DISPUTE_LABELS: Record<DisputeStatus, string> = {
  active: "Active",
  overdue: "Overdue",
  resolved: "Resolved",
  escalated: "Escalated",
};

interface DisputesState {
  disputes: PayrollDispute[];
  isLoading: boolean;
  error: string | null;
  setDisputes: (disputes: PayrollDispute[]) => void;
  resolveDispute: (id: string, reviewerName: string, role: UserRole, note?: string) => void;
  escalateDispute: (id: string, reviewerName: string, role: UserRole, note?: string) => void;
  dismissDispute: (id: string, reviewerName: string, role: UserRole, note?: string) => void;
  getFilteredDisputes: (filter: "all" | "active" | "overdue" | "resolved" | "blocked_finalization") => PayrollDispute[];
}

export const DISPUTE_STATUS_LABELS = DISPUTE_LABELS;

export const useDisputesStore = create<DisputesState>()(
  persist(
    (set, get) => ({
      disputes: MOCK_DISPUTES,
      isLoading: false,
      error: null,

      setDisputes: (disputes) => set({ disputes }),

      resolveDispute: (id, reviewerName, role, note) =>
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "resolved" as const,
                  blockedActions: [] as const,
                  resolvedAt: new Date().toISOString(),
                  resolvedBy: reviewerName,
                  resolutionNote: note ?? `Resolved by ${role} user ${reviewerName}.`,
                }
              : d
          ),
        })),

      escalateDispute: (id, reviewerName, role, note) =>
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "escalated" as const,
                  resolutionNote: note ?? `Escalated by ${role} user ${reviewerName}.`,
                }
              : d
          ),
        })),

      dismissDispute: (id, reviewerName, role, note) =>
        set((state) => ({
          disputes: state.disputes.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: "resolved" as const,
                  blockedActions: [] as const,
                  resolvedAt: new Date().toISOString(),
                  resolvedBy: reviewerName,
                  resolutionNote: note ?? `Dismissed by ${role} user ${reviewerName}.`,
                }
              : d
          ),
        })),

      getFilteredDisputes: (filter) => {
        const { disputes } = get();
        switch (filter) {
          case "active":
            return disputes.filter((d) => d.status === "active");
          case "overdue":
            return disputes.filter((d) => d.status === "overdue");
          case "resolved":
            return disputes.filter((d) => d.status === "resolved");
          case "blocked_finalization":
            return disputes.filter((d) => d.blockedActions.includes("finalization"));
          default:
            return disputes;
        }
      },
    }),
    { name: "zk-payroll-disputes" }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PayrollApprovalActionType =
  | "draft_created"
  | "review_initiated"
  | "proof_generated"
  | "proof_failed"
  | "wallet_signing"
  | "cancelled"
  | "submitted"
  | "submission_failed";

const ACTION_LABELS: Record<PayrollApprovalActionType, string> = {
  draft_created: "Draft Created",
  review_initiated: "Review Initiated",
  proof_generated: "Proof Generated",
  proof_failed: "Proof Failed",
  wallet_signing: "Wallet Signing",
  cancelled: "Cancelled",
  submitted: "Submitted",
  submission_failed: "Submission Failed",
};

export function getActionLabel(action: PayrollApprovalActionType): string {
  return ACTION_LABELS[action];
}

export interface PayrollApprovalEvent {
  id: string;
  payrollRunId: string;
  action: PayrollApprovalActionType;
  actor: string;
  actorRole?: string;
  timestamp: string;
  details?: string;
}

interface PayrollAuditTrailState {
  events: PayrollApprovalEvent[];
  logEvent: (event: Omit<PayrollApprovalEvent, "id" | "timestamp">) => void;
  getEventsForRun: (payrollRunId: string) => PayrollApprovalEvent[];
  clearEventsForRun: (payrollRunId: string) => void;
  setEvents: (events: PayrollApprovalEvent[]) => void;
}

let eventCounter = 0;

function generateId(): string {
  eventCounter += 1;
  return `paat_${Date.now()}_${eventCounter}`;
}

export const usePayrollAuditTrailStore = create<PayrollAuditTrailState>()(
  persist(
    (set, get) => ({
      events: [],

      logEvent: (event) =>
        set((state) => ({
          events: [
            ...state.events,
            {
              ...event,
              id: generateId(),
              timestamp: new Date().toISOString(),
            },
          ],
        })),

      getEventsForRun: (payrollRunId) =>
        get().events.filter((e) => e.payrollRunId === payrollRunId),

      clearEventsForRun: (payrollRunId) =>
        set((state) => ({
          events: state.events.filter((e) => e.payrollRunId !== payrollRunId),
        })),

      setEvents: (events) => set({ events }),
    }),
    {
      name: "zk-payroll-audit-trail",
    },
  ),
);


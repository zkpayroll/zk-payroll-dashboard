import { create } from "zustand";
import { buildPeriodCloseChecklist, type PeriodCloseInputs } from "@/lib/reconciliation/periodClose";
import { usePayrollAuditTrailStore } from "./payrollAuditTrail";

export interface ClosePeriodResult {
  success: boolean;
  error: string | null;
}

export interface ReopenPeriodResult {
  success: boolean;
  error: string | null;
}

export interface ReopenPeriodInputs {
  payrollRunId: string;
  reason: string;
  /** User who authorized the period reopen (for audit trail) */
  authorizedBy?: string;
  /** Role of the user who authorized the period reopen (for audit trail) */
  authorizedByRole?: string;
}

interface PeriodCloseStore {
  closedPayrollRunIds: string[];
  isClosed: (payrollRunId: string) => boolean;
  closePeriod: (inputs: PeriodCloseInputs) => ClosePeriodResult;
  reopenPeriod: (inputs: ReopenPeriodInputs) => ReopenPeriodResult;
}

export const usePeriodCloseStore = create<PeriodCloseStore>((set, get) => ({
  closedPayrollRunIds: [],

  isClosed: (payrollRunId) => get().closedPayrollRunIds.includes(payrollRunId),

  closePeriod: (inputs) => {
    if (get().isClosed(inputs.payrollRunId)) {
      return { success: false, error: "This period is already closed." };
    }

    const checklist = buildPeriodCloseChecklist(inputs);
    if (!checklist.canClose) {
      return { success: false, error: "This period has unresolved blockers and cannot be closed." };
    }

    set((state) => ({ closedPayrollRunIds: [...state.closedPayrollRunIds, inputs.payrollRunId] }));

    // Log audit evidence of period lock
    usePayrollAuditTrailStore.getState().logEvent({
      payrollRunId: inputs.payrollRunId,
      action: "period_locked",
      actor: inputs.authorizedBy || "System",
      actorRole: inputs.authorizedByRole,
      details: "Pay period locked after successful reconciliation",
    });

    return { success: true, error: null };
  },

  reopenPeriod: (inputs) => {
    if (!get().isClosed(inputs.payrollRunId)) {
      return { success: false, error: "This period is not currently closed." };
    }

    const trimmedReason = inputs.reason.trim();
    if (trimmedReason.length < 10) {
      return { success: false, error: "Please provide a reason with at least 10 characters." };
    }
    if (trimmedReason.length > 500) {
      return { success: false, error: "Reason must be 500 characters or fewer." };
    }

    set((state) => ({
      closedPayrollRunIds: state.closedPayrollRunIds.filter((id) => id !== inputs.payrollRunId),
    }));

    // Log audit evidence of period reopen
    usePayrollAuditTrailStore.getState().logEvent({
      payrollRunId: inputs.payrollRunId,
      action: "period_reopened",
      actor: inputs.authorizedBy || "System",
      actorRole: inputs.authorizedByRole,
      details: `Period reopened: ${trimmedReason}`,
    });

    return { success: true, error: null };
  },
}));

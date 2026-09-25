import { create } from "zustand";
import { buildPeriodCloseChecklist, type PeriodCloseInputs } from "@/lib/reconciliation/periodClose";

export interface ClosePeriodResult {
  success: boolean;
  error: string | null;
}

interface PeriodCloseStore {
  closedPayrollRunIds: string[];
  isClosed: (payrollRunId: string) => boolean;
  closePeriod: (inputs: PeriodCloseInputs) => ClosePeriodResult;
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
    return { success: true, error: null };
  },
}));

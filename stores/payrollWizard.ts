import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollWizardState, PayrollWizardStep } from "@/types";
import {
  getInstructionVersionStatus,
} from "@/src/payroll/instructionVersion";

const STEPS: PayrollWizardStep[] = ["review", "proof", "confirm", "submit"];

interface PayrollWizardStore extends PayrollWizardState {
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: PayrollWizardStep) => void;
  setEmployeeIds: (ids: string[]) => void;
  setTotalAmount: (amount: number) => void;
  setProof: (proof: string | null) => void;
  setProofStatus: (status: PayrollWizardState["proofStatus"]) => void;
  setProofError: (error: string | null) => void;
  setSubmissionStatus: (
    status: PayrollWizardState["submissionStatus"],
  ) => void;
  setSubmissionError: (error: string | null) => void;
  setTransactionHash: (hash: string | null) => void;
  /** Snapshot the saved policy's version for this draft (#534). */
  setInstructionVersion: (version: number | null) => void;
  setIsProofNearingExpiration: (val: boolean) => void;
  setTreasuryBalanceOverride: (balance: number | null) => void;
  reset: () => void;
  hasDraft: () => boolean;
  restoreDraft: () => void;
  clearDraft: () => void;
}

const initialState: PayrollWizardState = {
  currentStep: "review",
  employeeIds: [],
  totalAmount: 0,
  proof: null,
  proofStatus: "idle",
  proofError: null,
  submissionStatus: "idle",
  submissionError: null,
  transactionHash: null,
  isProofNearingExpiration: false,
  treasuryBalanceOverride: null,
};

/**
 * Compare the snapshotted draft version against the active saved policy
 * version (#534). A draft never silently adopts a newer policy: the badge
 * keeps showing the version the run was drafted under.
 */
export function getWizardInstructionVersionStatus(
  draftVersion: number | null | undefined,
  activeVersion: number | null | undefined,
) {
  return getInstructionVersionStatus(activeVersion, draftVersion);
}

export const usePayrollWizardStore = create<PayrollWizardStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      nextStep: () =>
        set((state) => {
          const idx = STEPS.indexOf(state.currentStep);
          if (idx < STEPS.length - 1) {
            return { currentStep: STEPS[idx + 1] };
          }
          return {};
        }),
      prevStep: () =>
        set((state) => {
          const idx = STEPS.indexOf(state.currentStep);
          if (idx > 0) {
            return { currentStep: STEPS[idx - 1] };
          }
          return {};
        }),
      goToStep: (step) => set({ currentStep: step }),
      setEmployeeIds: (employeeIds) => set({ employeeIds }),
      setTotalAmount: (totalAmount) => set({ totalAmount }),
      setProof: (proof) => set({ proof }),
      setProofStatus: (proofStatus) => set({ proofStatus }),
      setProofError: (proofError) => set({ proofError }),
      setSubmissionStatus: (submissionStatus) => set({ submissionStatus }),
      setSubmissionError: (submissionError) => set({ submissionError }),
      setTransactionHash: (transactionHash) => set({ transactionHash }),
      setInstructionVersion: (instructionVersion) => set({ instructionVersion }),
      setIsProofNearingExpiration: (isProofNearingExpiration) => set({ isProofNearingExpiration }),
      setTreasuryBalanceOverride: (treasuryBalanceOverride) => set({ treasuryBalanceOverride }),
      reset: () => set({ ...initialState }),
      hasDraft: () => {
        const state = get();
        return state.employeeIds.length > 0 || state.totalAmount > 0;
      },
      restoreDraft: () => {
        const state = get();
        if (state.employeeIds.length > 0 || state.totalAmount > 0) {
          set({ currentStep: "review" });
        }
      },
      clearDraft: () => set({ ...initialState, instructionVersion: null }),
    }),
    {
      name: "zk-payroll-wizard-draft",
      partialize: (state) => ({
        employeeIds: state.employeeIds,
        totalAmount: state.totalAmount,
        currentStep:
          state.currentStep === "submit" ? "review" : state.currentStep,
        proofStatus: "idle",
        proofError: null,
        submissionStatus: "idle",
        submissionError: null,
        proof: null,
        isProofNearingExpiration: false,
        treasuryBalanceOverride: null,
      }),
    },
  ),
);

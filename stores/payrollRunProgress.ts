/**
 * #470 – Payroll Run Progress Persistence
 *
 * Persists a minimal, non-sensitive snapshot of the active payroll batch
 * progress to localStorage so that operators can see where a run was
 * interrupted after a refresh or an accidental tab closure.
 *
 * Sensitive fields (employee amounts, salaries, proofs) are deliberately
 * excluded from the persisted payload. Only structural progress metadata
 * that is safe to store in-browser is written.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PayrollWizardStep } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Safe progress snapshot that can be stored in localStorage.
 * Intentionally omits any field that could expose payroll amounts or
 * employee-identifiable data.
 */
export interface PayrollRunProgressSnapshot {
  /** Internal run identifier generated at wizard start. */
  runId: string;
  /** Current wizard step the run was on when the snapshot was taken. */
  currentStep: PayrollWizardStep;
  /** Number of employees in the batch — count only, not IDs or amounts. */
  employeeCount: number;
  /** ISO-8601 timestamp of the last progress update. */
  updatedAt: string;
  /** Whether a ZK proof was successfully generated for this run. */
  proofReady: boolean;
  /** Whether the payroll has been fully submitted on-chain. */
  submitted: boolean;
}

interface PayrollRunProgressStore {
  snapshot: PayrollRunProgressSnapshot | null;

  /** Record a new progress snapshot for the given run. */
  recordProgress: (
    runId: string,
    currentStep: PayrollWizardStep,
    employeeCount: number,
    proofReady: boolean,
    submitted: boolean,
  ) => void;

  /** Clear progress after a successful submission or explicit discard. */
  clearProgress: () => void;

  /** Whether there is a non-submitted run snapshot available to restore. */
  hasResumableRun: () => boolean;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePayrollRunProgressStore = create<PayrollRunProgressStore>()(
  persist(
    (set, get) => ({
      snapshot: null,

      recordProgress: (runId, currentStep, employeeCount, proofReady, submitted) =>
        set({
          snapshot: {
            runId,
            currentStep,
            employeeCount,
            updatedAt: new Date().toISOString(),
            proofReady,
            submitted,
          },
        }),

      clearProgress: () => set({ snapshot: null }),

      hasResumableRun: () => {
        const { snapshot } = get();
        return snapshot !== null && !snapshot.submitted;
      },
    }),
    {
      name: "zk-payroll-run-progress",
      // Only persist the snapshot — nothing else.
      partialize: (state) => ({ snapshot: state.snapshot }),
    },
  ),
);

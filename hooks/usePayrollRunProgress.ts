"use client";

/**
 * #470 – usePayrollRunProgress
 *
 * Bridges the active PayrollWizardStore state into the persistent
 * PayrollRunProgressStore so that progress is recorded automatically
 * after each meaningful wizard transition.
 *
 * Usage: mount this hook inside PayrollWizard (or any parent layout that
 * should persist progress) to enable refresh recovery without any
 * additional wiring in calling code.
 */

import { useEffect } from "react";
import { usePayrollWizardStore } from "@/stores/payrollWizard";
import { usePayrollRunProgressStore } from "@/stores/payrollRunProgress";

interface UsePayrollRunProgressOptions {
  /** The runId generated when the payroll session was started. */
  runId: string | null;
}

/**
 * Automatically syncs wizard state → progress snapshot whenever
 * `currentStep`, `proofStatus`, or `submissionStatus` changes.
 */
export function usePayrollRunProgress({ runId }: UsePayrollRunProgressOptions) {
  const currentStep = usePayrollWizardStore((s) => s.currentStep);
  const employeeIds = usePayrollWizardStore((s) => s.employeeIds);
  const proofStatus = usePayrollWizardStore((s) => s.proofStatus);
  const submissionStatus = usePayrollWizardStore((s) => s.submissionStatus);

  const recordProgress = usePayrollRunProgressStore((s) => s.recordProgress);
  const clearProgress = usePayrollRunProgressStore((s) => s.clearProgress);

  useEffect(() => {
    if (!runId || employeeIds.length === 0) return;

    const proofReady = proofStatus === "success";
    const submitted = submissionStatus === "success";

    if (submitted) {
      // Successful submission → remove the snapshot so the banner doesn't
      // reappear on the next page load.
      clearProgress();
      return;
    }

    recordProgress(runId, currentStep, employeeIds.length, proofReady, submitted);
  }, [runId, currentStep, employeeIds.length, proofStatus, submissionStatus, recordProgress, clearProgress]);
}

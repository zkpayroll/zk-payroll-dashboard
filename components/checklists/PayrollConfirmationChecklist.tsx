"use client";

import { useState } from "react";
import { ClipboardCheck, Lock, CheckCircle2 } from "lucide-react";
import {
  createDefaultConfirmationChecklist,
  toggleConfirmationCheck,
  evaluateConfirmationReadiness,
  CONFIRMATION_CATEGORY_LABELS,
  type PayrollConfirmationCheck,
  type ConfirmationCheckCategory,
} from "@/src/payroll/confirmationChecklist";

export interface PayrollConfirmationChecklistProps {
  payrollRunId: string;
  /** Optional initial checklist; defaults to the standard required checks. */
  initialChecks?: PayrollConfirmationCheck[];
  onConfirm?: (payrollRunId: string) => void;
}

const CATEGORY_ORDER: ConfirmationCheckCategory[] = [
  "treasury",
  "employee_data",
  "approval",
  "network",
];

export function PayrollConfirmationChecklist({
  payrollRunId,
  initialChecks,
  onConfirm,
}: PayrollConfirmationChecklistProps) {
  const [checks, setChecks] = useState<PayrollConfirmationCheck[]>(
    () => initialChecks ?? createDefaultConfirmationChecklist(),
  );

  const evaluation = evaluateConfirmationReadiness(checks);

  const handleToggle = (checkId: string) => {
    setChecks((prev) => toggleConfirmationCheck(prev, checkId));
  };

  return (
    <div
      data-testid="payroll-confirmation-checklist"
      data-can-confirm={evaluation.canConfirm ? "true" : "false"}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            Payroll Confirmation Checklist
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Run {payrollRunId} — verify every required check before confirming submission.
          </p>
        </div>
        <span
          role="status"
          data-testid="confirmation-progress"
          className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1 rounded-lg"
        >
          {evaluation.verifiedRequiredCount} / {evaluation.requiredCount} required verified
        </span>
      </div>

      <p
        role="status"
        data-testid="confirmation-status-message"
        className={`text-xs font-medium ${evaluation.canConfirm ? "text-green-700" : "text-amber-700"}`}
      >
        {evaluation.statusMessage}
      </p>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const categoryChecks = checks.filter((c) => c.category === category);
          if (categoryChecks.length === 0) return null;
          return (
            <fieldset key={category} className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                {CONFIRMATION_CATEGORY_LABELS[category]}
              </legend>
              {categoryChecks.map((check) => (
                <label
                  key={check.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={check.isVerified}
                    onChange={() => handleToggle(check.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label={`Verify: ${check.label}`}
                  />
                  <span className={check.isVerified ? "text-gray-400 line-through" : "text-gray-700"}>
                    {check.label}
                    {!check.isRequired && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">
                        (optional)
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Lock className="h-3.5 w-3.5" />
          Checklist tracks verification only — no salary or payment values are stored.
        </span>
        <button
          type="button"
          disabled={!evaluation.canConfirm}
          onClick={() => onConfirm?.(payrollRunId)}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          aria-describedby={evaluation.canConfirm ? undefined : "confirmation-status-message"}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirm Payroll Run
        </button>
      </div>
    </div>
  );
}

export default PayrollConfirmationChecklist;

import { AlertTriangle } from "lucide-react";
import { getSubmissionSequenceWarning } from "@/src/payroll/submissionSequence";
import type { SubmissionSequenceInput } from "@/src/payroll/submissionSequence";

type Props = SubmissionSequenceInput & { onReset: () => void };

export function PayrollSubmissionSequenceWarning({ onReset, ...sequence }: Props) {
  const message = getSubmissionSequenceWarning(sequence);
  if (!message) return null;

  return (
    <div role="alert" data-testid="payroll-submission-sequence-warning" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900">Payroll submission sequence needs attention</h4>
          <p className="mt-1 text-sm text-amber-800">{message}</p>
          <button type="button" onClick={onReset} className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100">
            Return to payroll review
          </button>
        </div>
      </div>
    </div>
  );
}

export default PayrollSubmissionSequenceWarning;

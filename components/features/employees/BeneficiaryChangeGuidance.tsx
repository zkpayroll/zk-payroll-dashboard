"use client";

import { evaluateBeneficiaryChangeReadiness, type BeneficiaryChangeRequest, type WorkflowEvaluationContext } from "@/src/payroll/beneficiaryChangeVerificationWorkflow";
import { describeBeneficiaryChangeGuidance, type BeneficiaryChangeGuidanceTone } from "@/lib/employees/beneficiaryChangeGuidance";

export interface BeneficiaryChangeGuidanceProps {
  request: BeneficiaryChangeRequest;
  context?: WorkflowEvaluationContext;
}

const TONE_CLASS: Record<BeneficiaryChangeGuidanceTone, string> = {
  ready: "border-green-200 bg-green-50 text-green-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  blocked: "border-red-200 bg-red-50 text-red-900",
};

/** Shows what an operator should do next for a beneficiary change (#902). */
export function BeneficiaryChangeGuidance({ request, context }: BeneficiaryChangeGuidanceProps) {
  const decision = evaluateBeneficiaryChangeReadiness(
    request,
    context ?? { now: Date.now(), isPayrollInProgress: false },
  );
  const guidance = describeBeneficiaryChangeGuidance(decision);

  return (
    <section
      role="status"
      aria-labelledby={`beneficiary-guidance-${request.id}`}
      className={`rounded-lg border p-4 text-sm ${TONE_CLASS[guidance.tone]}`}
      data-testid="beneficiary-change-guidance"
      data-tone={guidance.tone}
    >
      <h3 id={`beneficiary-guidance-${request.id}`} className="font-semibold">
        {guidance.title}
      </h3>
      <p className="mt-1">{guidance.body}</p>
      {guidance.nextSteps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5" data-testid="beneficiary-change-next-steps">
          {guidance.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

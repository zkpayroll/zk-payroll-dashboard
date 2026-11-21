"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import {
  evaluateBeneficiaryVerificationStatus,
  type BeneficiaryVerificationStatus,
} from "@/lib/payroll/beneficiaryVerificationStatus";
import type { BeneficiaryChangeRequest, WorkflowEvaluationContext } from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

export interface DashboardBeneficiaryVerificationStatusCheckProps {
  requests?: BeneficiaryChangeRequest[] | null;
  context?: WorkflowEvaluationContext;
  className?: string;
}

function toneClass(status: BeneficiaryVerificationStatus): string {
  return status === "ready" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50";
}

export default function DashboardBeneficiaryVerificationStatusCheck({
  requests,
  context,
  className = "",
}: DashboardBeneficiaryVerificationStatusCheckProps) {
  const evaluation = evaluateBeneficiaryVerificationStatus(
    requests ?? [],
    context ?? { now: Date.now(), isPayrollInProgress: false },
  );
  const isReady = evaluation.status === "ready";

  return (
    <section
      role="status"
      aria-labelledby="dashboard-beneficiary-verification-heading"
      className={`rounded-lg border p-4 transition-all ${toneClass(evaluation.status)} ${className}`}
      data-testid="dashboard-beneficiary-verification"
      data-status={evaluation.status}
      data-ready-count={evaluation.readyCount}
      data-pending-count={evaluation.pendingCount}
      data-blocked-count={evaluation.blockedCount}
    >
      <div className="flex items-start gap-3">
        {isReady ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
        ) : (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h3 id="dashboard-beneficiary-verification-heading" className="text-sm font-semibold text-gray-900">
            Beneficiary verification
          </h3>
          <p
            className={`mt-1 text-sm ${isReady ? "text-green-800" : "text-amber-800"}`}
            data-testid="dashboard-beneficiary-verification-summary"
          >
            {evaluation.summaryMessage}
          </p>
        </div>
      </div>
    </section>
  );
}

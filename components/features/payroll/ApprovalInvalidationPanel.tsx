"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  evaluateApprovalInvalidation,
  type ApprovalInvalidationEvaluation,
  type ApprovalInvalidationInput,
} from "@/src/payroll/approvalInvalidation";
import { usePayrollDraftsStore } from "@/stores/payrollDrafts";

export interface ApprovalInvalidationPanelProps {
  input?: ApprovalInvalidationInput | null;
  evaluation?: ApprovalInvalidationEvaluation | null;
  now?: number;
  title?: string;
  reviewHref?: string;
  recoveryHref?: string;
  draftId?: string;
  onRecover?: () => void;
}

export function ApprovalInvalidationPanel({
  input,
  evaluation: providedEvaluation,
  now = Date.now(),
  title = "Approval validity",
  reviewHref = "/payroll/review",
  recoveryHref = "/payroll/recovery",
  draftId,
  onRecover,
}: ApprovalInvalidationPanelProps) {
  const invalidateApproval = usePayrollDraftsStore(
    (state) => state.invalidateApproval,
  );

  const evaluation = useMemo(
    () =>
      providedEvaluation ??
      evaluateApprovalInvalidation(input ?? { hasApproval: false }, now),
    [providedEvaluation, input, now],
  );

  const showRecovery =
    evaluation.invalid && (Boolean(onRecover) || Boolean(draftId));

  function handleRecover() {
    if (onRecover) {
      onRecover();
      return;
    }
    if (draftId) {
      invalidateApproval(draftId, evaluation.reason ?? undefined);
    }
  }

  return (
    <section
      data-testid="approval-invalidation-panel"
      data-reason={evaluation.reason ?? "none"}
      aria-labelledby="approval-invalidation-heading"
      role={evaluation.invalid ? "alert" : "status"}
      className={`rounded-lg border p-4 ${
        evaluation.invalid
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {evaluation.invalid ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <h2
              id="approval-invalidation-heading"
              className="text-sm font-semibold"
            >
              {title}
            </h2>
            <span
              data-testid={`approval-invalidation-${evaluation.invalid ? "invalid" : "valid"}`}
            >
              <span
                data-testid="approval-invalidation-status"
                className="text-xs font-medium"
              >
                {evaluation.label}
              </span>
            </span>
          </div>
          <p
            data-testid="approval-invalidation-message"
            className="text-sm leading-snug"
          >
            {evaluation.message}
          </p>
          {evaluation.invalid && (
            <p
              data-testid="approval-invalidation-next-step"
              className="text-xs leading-snug"
            >
              {evaluation.nextStep}
            </p>
          )}
          {evaluation.blockedRowCount > 0 && (
            <p
              data-testid="approval-invalidation-row-count"
              className="text-xs"
            >
              {evaluation.blockedRowCount} blocked row(s) require re-approval.
            </p>
          )}
        </div>

        {evaluation.invalid && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={reviewHref}
              data-testid="approval-invalidation-review-link"
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Review changes
            </Link>
            {showRecovery ? (
              <button
                type="button"
                onClick={handleRecover}
                data-testid="approval-invalidation-recover-button"
                className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Reopen comparison
              </button>
            ) : (
              <Link
                href={recoveryHref}
                data-testid="approval-invalidation-recovery-link"
                className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Recovery options
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ApprovalInvalidationPanel;

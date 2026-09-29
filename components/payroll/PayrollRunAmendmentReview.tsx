"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  EyeOff,
  FileText,
  CheckCircle2,
} from "lucide-react";
import type { PayrollRun } from "@/types/models";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import { createPayrollRunAmendmentReview } from "@/src/payroll/amendments";
import { formatCommitmentShort } from "@/lib/privacy/amendments";

export interface PayrollRunAmendmentReviewProps {
  originalRun: PayrollRun;
  amendment: SalaryCommitmentAmendment;
  onApprove?: (amendmentId: string) => void;
  onReject?: (amendmentId: string) => void;
  className?: string;
}

export function PayrollRunAmendmentReview({
  originalRun,
  amendment,
  onApprove,
  onReject,
  className = "",
}: PayrollRunAmendmentReviewProps) {
  const review = createPayrollRunAmendmentReview(originalRun, amendment);
  const { originalRun: run, amendment: amd, validation, safeDiff } = review;

  return (
    <div
      data-testid={`payroll-amendment-review-${amd.id}`}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6 ${className}`}
    >
      {/* Header & Immutability Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              Payroll Run Amendment Review
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              Original Record Protected
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Reviewing amendment details for Employee {amd.employeeReference} without overwriting the original payroll record.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
          <EyeOff className="h-3.5 w-3.5 text-gray-400" />
          <span>Salary values encrypted</span>
        </div>
      </div>

      {/* Warning / Error Banner if Stale or Blocked */}
      {review.warning && (
        <div
          role="alert"
          data-testid="amendment-review-warning"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
        >
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Amendment Review Blocked</p>
            <p className="text-red-700 mt-0.5">{review.warning}</p>
            {validation.nextSteps && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                Recommended Action: {validation.nextSteps}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison: Original Record vs Amendment Proposal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original Payroll Record (Immutable) */}
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              Original Payroll Record
            </span>
            <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-medium">
              Immutable
            </span>
          </div>

          <div className="space-y-1.5 text-sm text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-500">Run ID:</span>
              <span className="font-mono font-medium">{run.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className="font-medium capitalize">{run.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Period:</span>
              <span className="font-medium">{amd.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Commitment Version:</span>
              <span className="font-mono font-medium">v{amd.previousVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Commitment Hash:</span>
              <span className="font-mono text-xs">{formatCommitmentShort(amd.previousCommitment)}</span>
            </div>
          </div>
        </div>

        {/* Proposed Amendment Details */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Proposed Amendment Details
            </span>
            <span className="text-xs text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-medium">
              {amd.approvalStatus}
            </span>
          </div>

          <div className="space-y-1.5 text-sm text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-500">Amendment ID:</span>
              <span className="font-mono font-medium">{amd.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Proposed Version:</span>
              <span className="font-mono font-semibold text-indigo-700">v{amd.commitmentVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Next Commitment:</span>
              <span className="font-mono text-xs text-indigo-900">{formatCommitmentShort(amd.nextCommitment)}</span>
            </div>
            {amd.reason && (
              <div className="pt-1 border-t border-indigo-100 text-xs text-indigo-900">
                <span className="font-medium">Rationale:</span> {amd.reason}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safe Diff Overview */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Privacy-Safe Safe Diff Summary
        </h3>
        <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Field</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Current Record</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Proposed Amendment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {safeDiff.fields.map((f, idx) => (
                <tr key={idx} className={f.changed ? "bg-amber-50/40" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-700">{f.label}</td>
                  <td className="px-3 py-2 text-gray-600 font-mono">{f.before}</td>
                  <td className="px-3 py-2 text-gray-900 font-mono font-medium">
                    {f.after} {f.changed && <span className="text-amber-600 text-[10px] ml-1">(changed)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-xs text-gray-500">
          Reviewing amendment leaves original payroll run untouched.
        </span>

        <div className="flex items-center gap-2">
          {onReject && (
            <button
              type="button"
              onClick={() => onReject(amd.id)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Reject Amendment
            </button>
          )}
          {onApprove && (
            <button
              type="button"
              onClick={() => onApprove(amd.id)}
              disabled={!validation.canApprove}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve Amendment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PayrollRunAmendmentReview;

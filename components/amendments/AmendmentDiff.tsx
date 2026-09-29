"use client";

import { ArrowRight, EyeOff, Lock } from "lucide-react";
import { getAmendmentSafeDiff, formatAsset } from "@/lib/sdk/amendments";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import { AMENDMENT_COMMITMENT_COPY, AMENDMENT_PRIVACY_NOTICE, formatCommitmentShort } from "@/lib/privacy/amendments";

interface AmendmentDiffProps {
  amendment: SalaryCommitmentAmendment;
  compact?: boolean;
}

function DiffArrow() {
  return (
    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
  );
}

export function AmendmentDiff({ amendment, compact = false }: AmendmentDiffProps) {
  const diff = getAmendmentSafeDiff(amendment);

  return (
    <section
      data-testid="amendment-diff"
      aria-labelledby="amendment-diff-heading"
      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
    >
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h3
          id="amendment-diff-heading"
          className="text-sm font-semibold text-gray-900"
        >
          Safe metadata changes
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Only commitment version, employee reference, period, asset, and
          approval status are shown. Salary values stay encrypted.
        </p>
      </div>

      <div className={`divide-y divide-gray-100 ${compact ? "" : ""}`}>
        {/* Commitment version */}
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Commitment version
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-gray-600 font-mono">v{amendment.previousVersion}</span>
            <DiffArrow />
            <span className="text-gray-900 font-mono font-semibold">v{amendment.commitmentVersion}</span>
            {amendment.previousVersion !== amendment.commitmentVersion && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs">
                Changed
              </span>
            )}
          </span>
        </div>

        {/* Employee reference */}
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Employee reference
          </span>
          <span className="text-sm font-medium text-gray-900">
            {amendment.employeeReference}
          </span>
        </div>

        {/* Period */}
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Period
          </span>
          <span className="text-sm text-gray-900 font-mono">{amendment.period}</span>
        </div>

        {/* Asset */}
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Asset
          </span>
          <span className="text-sm text-gray-900">{formatAsset(amendment.asset)}</span>
        </div>

        {/* Approval status */}
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Approval status
          </span>
          <span
            data-testid="amendment-approval-status"
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              amendment.approvalStatus === "approved"
                ? "bg-green-50 text-green-700 border-green-200"
                : amendment.approvalStatus === "pending"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : amendment.approvalStatus === "blocked"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : amendment.approvalStatus === "failed"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            {amendment.approvalStatus}
          </span>
        </div>

        {/* Commitment hashes */}
        <div className="px-4 sm:px-6 py-4 bg-gray-50/50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Encrypted commitments (hashes only)
          </p>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs">
              <span className="text-gray-500 shrink-0">Previous:</span>
              <span className="font-mono text-gray-700 truncate" title={amendment.previousCommitment}>
                {formatCommitmentShort(amendment.previousCommitment, 18)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <DiffArrow />
              <span className="text-gray-500">Next:</span>
              <span className="font-mono text-gray-900 font-medium truncate" title={amendment.nextCommitment}>
                {formatCommitmentShort(amendment.nextCommitment, 18)}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
            <Lock className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
            {AMENDMENT_COMMITMENT_COPY}
          </p>
        </div>
      </div>

      <footer className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-indigo-50/50 flex items-start gap-2 text-xs text-indigo-700">
        <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{AMENDMENT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default AmendmentDiff;

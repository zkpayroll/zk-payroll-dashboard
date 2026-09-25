"use client";

import React from "react";
import { ShieldCheck, AlertCircle, AlertTriangle, Info, UserX } from "lucide-react";
import type { ApprovalRequirementsPolicy, PolicyValidationIssue } from "@/types/policy";

interface ApprovalsPolicySectionProps {
  approvals: ApprovalRequirementsPolicy;
  onChange: (updates: Partial<ApprovalRequirementsPolicy>) => void;
  issues: PolicyValidationIssue[];
}

export function ApprovalsPolicySection({ approvals, onChange, issues }: ApprovalsPolicySectionProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <section
      aria-labelledby="approvals-section-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="approvals-section-heading" className="text-base font-semibold text-gray-900">
              Approval Requirements & Governance
            </h2>
            <p className="text-xs text-gray-500">
              Configure quorum thresholds, executive dual approval, and segregation of duties.
            </p>
          </div>
        </div>
        {errors.length > 0 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        ) : warnings.length > 0 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            Valid
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="required-approvals-count"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Required Approvals Count *
          </label>
          <input
            id="required-approvals-count"
            name="requiredApprovalsCount"
            type="number"
            min="1"
            max="10"
            value={approvals.requiredApprovalsCount}
            onChange={(e) =>
              onChange({ requiredApprovalsCount: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Minimum number of unique cryptographic signatures needed to release payroll batch.
          </p>
        </div>

        <div>
          <label
            htmlFor="dual-approval-threshold"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Dual Approval Payout Threshold *
          </label>
          <input
            id="dual-approval-threshold"
            name="dualApprovalThreshold"
            type="number"
            min="1"
            value={approvals.dualApprovalThreshold}
            onChange={(e) =>
              onChange({ dualApprovalThreshold: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Disbursement amount exceeding this threshold triggers mandatory secondary executive sign-off.
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <input
            id="require-dual-approval"
            name="requireDualApproval"
            type="checkbox"
            checked={approvals.requireDualApproval}
            onChange={(e) => onChange({ requireDualApproval: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <label htmlFor="require-dual-approval" className="text-xs font-semibold text-gray-900 cursor-pointer block">
              Enforce Dual Approval for High-Value Batches
            </label>
            <p className="text-xs text-gray-500">
              When enabled, batches exceeding the threshold cannot be submitted by a single operator.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="require-auditor-approval"
            name="requireAuditorApproval"
            type="checkbox"
            checked={approvals.requireAuditorApproval}
            onChange={(e) => onChange({ requireAuditorApproval: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <label htmlFor="require-auditor-approval" className="text-xs font-semibold text-gray-900 cursor-pointer block">
              Require Compliance Auditor Sign-Off
            </label>
            <p className="text-xs text-gray-500">
              Mandates that assigned compliance auditors verify ZK commitments before execution.
            </p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-start gap-3">
            <input
              id="allow-self-approval"
              name="allowSelfApproval"
              type="checkbox"
              checked={approvals.allowSelfApproval}
              onChange={(e) => onChange({ allowSelfApproval: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <div className="flex items-center gap-2">
                <label htmlFor="allow-self-approval" className="text-xs font-semibold text-gray-900 cursor-pointer block">
                  Allow Submitter Self-Approval
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  <UserX className="w-3 h-3" aria-hidden="true" />
                  Elevated Risk
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Permits the operator who assembled the batch to contribute one of the required approvals.
                Strictly prohibited when required approvals count is 1.
              </p>
            </div>
          </div>
        </div>
      </div>


      {issues.length > 0 && (
        <div className="space-y-2 pt-2">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                issue.severity === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : issue.severity === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {issue.severity === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              ) : issue.severity === "warning" ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
              ) : (
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <span className="font-semibold">{issue.title}:</span> {issue.message}
                {issue.remediation && (
                  <p className="mt-0.5 text-[11px] opacity-90 font-medium">Tip: {issue.remediation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

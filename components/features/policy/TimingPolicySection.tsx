"use client";

import React from "react";
import { Clock, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { SettlementWindowPolicy, PolicyValidationIssue } from "@/types/policy";

interface TimingPolicySectionProps {
  timing: SettlementWindowPolicy;
  onChange: (updates: Partial<SettlementWindowPolicy>) => void;
  issues: PolicyValidationIssue[];
}

export function TimingPolicySection({ timing, onChange, issues }: TimingPolicySectionProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <section
      aria-labelledby="timing-section-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Clock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="timing-section-heading" className="text-base font-semibold text-gray-900">
              Timing & Settlement Windows
            </h2>
            <p className="text-xs text-gray-500">
              Define the lead time, dispute window, and execution grace period for scheduled batches.
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label
            htmlFor="settlement-window-hours"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Settlement Window (Hours) *
          </label>
          <input
            id="settlement-window-hours"
            name="settlementWindowHours"
            type="number"
            min="1"
            max="336"
            value={timing.settlementWindowHours}
            onChange={(e) =>
              onChange({ settlementWindowHours: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Window during which batches can be reviewed prior to on-chain disbursement.
          </p>
        </div>

        <div>
          <label
            htmlFor="cutoff-lead-time-hours"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Cutoff Lead Time (Hours) *
          </label>
          <input
            id="cutoff-lead-time-hours"
            name="cutoffLeadTimeHours"
            type="number"
            min="0"
            max="168"
            value={timing.cutoffLeadTimeHours}
            onChange={(e) =>
              onChange({ cutoffLeadTimeHours: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Must be strictly less than settlement window. Submissions freeze at cutoff.
          </p>
        </div>

        <div>
          <label
            htmlFor="execution-grace-period-hours"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Execution Grace Period (Hours) *
          </label>
          <input
            id="execution-grace-period-hours"
            name="executionGracePeriodHours"
            type="number"
            min="1"
            max="72"
            value={timing.executionGracePeriodHours}
            onChange={(e) =>
              onChange({ executionGracePeriodHours: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Buffer for operators to finalize disbursement before the batch expires.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <input
            id="timing-auto-settle"
            name="autoSettle"
            type="checkbox"
            checked={timing.autoSettle}
            onChange={(e) => onChange({ autoSettle: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <label htmlFor="timing-auto-settle" className="text-xs font-semibold text-gray-900 cursor-pointer block">
              Enable Automated Execution (Auto-Settle)
            </label>
            <p className="text-xs text-gray-500">
              When enabled, payroll disbursements trigger automatically once the settlement window concludes without disputes.
            </p>
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

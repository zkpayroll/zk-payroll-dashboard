"use client";

import React from "react";
import { Landmark, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReserveRulesPolicy, ShortfallAction, PolicyValidationIssue } from "@/types/policy";

interface ReservesPolicySectionProps {
  reserves: ReserveRulesPolicy;
  onChange: (updates: Partial<ReserveRulesPolicy>) => void;
  issues: PolicyValidationIssue[];
}

export function ReservesPolicySection({ reserves, onChange, issues }: ReservesPolicySectionProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <section
      aria-labelledby="reserves-section-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Landmark className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="reserves-section-heading" className="text-base font-semibold text-gray-900">
              Treasury Reserves & Liquidity Guardrails
            </h2>
            <p className="text-xs text-gray-500">
              Set liquidity floors, replenishment thresholds, and automated actions when reserves deplete.
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
            htmlFor="min-reserve-percentage"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Minimum Reserve Buffer (%) *
          </label>
          <input
            id="min-reserve-percentage"
            name="minReservePercentage"
            type="number"
            min="0"
            max="100"
            value={reserves.minReservePercentage}
            onChange={(e) =>
              onChange({ minReservePercentage: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Percentage of projected payroll total that must remain untouched in treasury.
          </p>
        </div>

        <div>
          <label
            htmlFor="min-reserve-fixed-amount"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Fixed Reserve Floor Amount *
          </label>
          <input
            id="min-reserve-fixed-amount"
            name="minReserveFixedAmount"
            type="number"
            min="0"
            value={reserves.minReserveFixedAmount}
            onChange={(e) =>
              onChange({ minReserveFixedAmount: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Absolute token balance floor regardless of payroll batch size.
          </p>
        </div>

        <div>
          <label
            htmlFor="replenish-threshold-percentage"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Replenishment Alert Threshold (%) *
          </label>
          <input
            id="replenish-threshold-percentage"
            name="replenishThresholdPercentage"
            type="number"
            min="0"
            max="100"
            value={reserves.replenishThresholdPercentage}
            onChange={(e) =>
              onChange({ replenishThresholdPercentage: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Triggers warning notices to treasury admins before reserves dip below buffer.
          </p>
        </div>

        <div>
          <label
            htmlFor="shortfall-policy"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Reserve Shortfall Policy *
          </label>
          <select
            id="shortfall-policy"
            name="shortfallPolicy"
            value={reserves.shortfallPolicy}
            onChange={(e) =>
              onChange({ shortfallPolicy: e.target.value as ShortfallAction })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="block">Block Execution (Strict Guarantee)</option>
            <option value="require_approval">Require Admin Multisig Override</option>
            <option value="warn">Warn Operator (Permit Execution)</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            Behavior when treasury balance cannot satisfy both payroll and minimum reserve floor.
          </p>
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

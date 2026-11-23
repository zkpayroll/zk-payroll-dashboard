"use client";

import React from "react";
import { Gauge, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { CapacityLimitsPolicy, PolicyValidationIssue } from "@/types/policy";

interface CapacityPolicySectionProps {
  capacity: CapacityLimitsPolicy;
  onChange: (updates: Partial<CapacityLimitsPolicy>) => void;
  issues: PolicyValidationIssue[];
}

export function CapacityPolicySection({ capacity, onChange, issues }: CapacityPolicySectionProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <section
      aria-labelledby="capacity-section-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <Gauge className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="capacity-section-heading" className="text-base font-semibold text-gray-900">
              Throughput & Capacity Limits
            </h2>
            <p className="text-xs text-gray-500">
              Set maximum batch sizes, single-run caps, and 24-hour cumulative disbursement limits.
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
            htmlFor="max-batch-size"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Max Batch Size (Recipients) *
          </label>
          <input
            id="max-batch-size"
            name="maxBatchSize"
            type="number"
            min="1"
            max="5000"
            value={capacity.maxBatchSize}
            onChange={(e) => onChange({ maxBatchSize: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Max employees included per ZK proof. Soroban limit is 5,000.
          </p>
        </div>

        <div>
          <label
            htmlFor="max-total-disbursement"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Max Total Disbursement Per Batch *
          </label>
          <input
            id="max-total-disbursement"
            name="maxTotalDisbursement"
            type="number"
            min="1"
            value={capacity.maxTotalDisbursement}
            onChange={(e) =>
              onChange({ maxTotalDisbursement: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Maximum cumulative value in base units released by any single batch.
          </p>
        </div>

        <div>
          <label
            htmlFor="daily-disbursement-limit"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            24-Hour Daily Disbursement Limit *
          </label>
          <input
            id="daily-disbursement-limit"
            name="dailyDisbursementLimit"
            type="number"
            min="1"
            value={capacity.dailyDisbursementLimit}
            onChange={(e) =>
              onChange({ dailyDisbursementLimit: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Must be greater than or equal to single-batch limit. Rolling 24h ceiling.
          </p>
        </div>

        <div>
          <label
            htmlFor="max-consecutive-batches"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Max Batches Per 24-Hour Period *
          </label>
          <input
            id="max-consecutive-batches"
            name="maxConsecutiveBatches"
            type="number"
            min="1"
            max="50"
            value={capacity.maxConsecutiveBatches}
            onChange={(e) =>
              onChange({ maxConsecutiveBatches: Number(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Protects against spam submissions and Soroban RPC rate limiting.
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

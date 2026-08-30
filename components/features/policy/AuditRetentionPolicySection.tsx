"use client";

import React from "react";
import { Archive, AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AuditRetentionPolicy, PolicyValidationIssue } from "@/types/policy";

interface AuditRetentionPolicySectionProps {
  auditRetention: AuditRetentionPolicy;
  onChange: (updates: Partial<AuditRetentionPolicy>) => void;
  issues: PolicyValidationIssue[];
}

export function AuditRetentionPolicySection({
  auditRetention,
  onChange,
  issues,
}: AuditRetentionPolicySectionProps) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const presets = [90, 180, 365, 730, 2555];

  return (
    <section
      aria-labelledby="audit-section-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Archive className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="audit-section-heading" className="text-base font-semibold text-gray-900">
              Audit Trails & Retention Settings
            </h2>
            <p className="text-xs text-gray-500">
              Configure data retention lifecycles, cryptographic immutability, and export compliance.
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

      <div className="space-y-4">
        <div>
          <label
            htmlFor="retention-period-days"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Audit Log Retention Period (Days) *
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="retention-period-days"
              name="retentionPeriodDays"
              type="number"
              min="30"
              max="3650"
              value={auditRetention.retentionPeriodDays}
              onChange={(e) =>
                onChange({ retentionPeriodDays: Number(e.target.value) })
              }
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-indigo-500"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 mr-1">Presets:</span>
              {presets.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ retentionPeriodDays: days })}
                  className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                    auditRetention.retentionPeriodDays === days
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {days === 365 ? "1 Year" : days === 730 ? "2 Years" : days === 2555 ? "7 Years" : `${days}d`}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Minimum required by regulatory compliance is 30 days; standard enterprise is 365 days.
          </p>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <input
              id="immutable-audit-log"
              name="immutableAuditLog"
              type="checkbox"
              checked={auditRetention.immutableAuditLog}
              onChange={(e) => onChange({ immutableAuditLog: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <label htmlFor="immutable-audit-log" className="text-xs font-semibold text-gray-900 cursor-pointer block">
                Enforce Immutable Cryptographic Audit Log
              </label>
              <p className="text-xs text-gray-500">
                Anchors all batch verification proofs and admin signatures to the on-chain audit ledger.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="require-auditor-export-signoff"
              name="requireAuditorExportSignoff"
              type="checkbox"
              checked={auditRetention.requireAuditorExportSignoff}
              onChange={(e) =>
                onChange({ requireAuditorExportSignoff: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <label htmlFor="require-auditor-export-signoff" className="text-xs font-semibold text-gray-900 cursor-pointer block">
                Require Auditor Sign-Off for Full Export Bundles
              </label>
              <p className="text-xs text-gray-500">
                Prevents unapproved downloads of sensitive cryptographic evidence packages.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="detailed-telemetry"
              name="detailedTelemetry"
              type="checkbox"
              checked={auditRetention.detailedTelemetry}
              onChange={(e) => onChange({ detailedTelemetry: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <label htmlFor="detailed-telemetry" className="text-xs font-semibold text-gray-900 cursor-pointer block">
                Capture Detailed Verification Telemetry
              </label>
              <p className="text-xs text-gray-500">
                Logs proof verification timings, Soroban resource consumption, and simulation passes.
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

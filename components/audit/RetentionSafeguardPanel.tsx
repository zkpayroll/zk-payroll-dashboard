"use client";

import { Archive, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuditRetentionPolicy } from "@/types/policy";
import {
  evaluateAuditRetention,
  type AuditRecordMeta,
} from "@/src/audit/recordRetention";

export interface RetentionSafeguardPanelProps {
  policy: AuditRetentionPolicy;
  records: AuditRecordMeta[];
  now?: number;
}

export function RetentionSafeguardPanel({
  policy,
  records,
  now,
}: RetentionSafeguardPanelProps) {
  const evaluation = evaluateAuditRetention(
    records,
    policy,
    now ?? Date.now(),
  );

  return (
    <div
      data-testid="retention-safeguard-panel"
      data-policy-valid={evaluation.policyValid ? "true" : "false"}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Archive className="h-5 w-5 text-amber-600" />
          Audit Retention Safeguards
        </h2>
        <span
          data-testid="retention-safeguard-summary"
          className={`text-xs font-medium px-3 py-1 rounded-lg border ${
            evaluation.policyValid
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {evaluation.protectedCount} protected · {evaluation.prunableCount} prunable
        </span>
      </div>

      {!evaluation.policyValid && (
        <div
          role="alert"
          data-testid="retention-policy-errors"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs"
        >
          <p className="font-semibold text-red-800 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" />
            Retention policy needs fixes
          </p>
          <ul className="mt-1 list-disc list-inside text-red-700 space-y-0.5">
            {evaluation.policyErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.policyValid && records.length === 0 && (
        <div className="text-center py-6 text-xs text-gray-400 border border-dashed rounded-lg">
          No audit records to evaluate. Records appear here as payroll activity is audited.
        </div>
      )}

      {evaluation.policyValid && records.length > 0 && (
        <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
          {evaluation.decisions.map((decision) => (
            <li key={decision.recordId} className="p-3 text-xs flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-gray-900">
                    {decision.recordId}
                  </span>
                  <span
                    data-testid={`retention-decision-${decision.recordId}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${
                      decision.allowed
                        ? "bg-gray-50 text-gray-600 border-gray-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }`}
                  >
                    {decision.allowed ? "Prunable" : "Protected"}
                  </span>
                </div>
                {decision.reasons.length > 0 && (
                  <ul className="text-gray-500 space-y-0.5">
                    {decision.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
              {!decision.allowed && (
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RetentionSafeguardPanel;

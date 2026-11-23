"use client";

import { Archive, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuditRetentionPolicy } from "@/types/policy";
import {
  evaluateAuditRetention,
  evaluateRetentionPurgeGuard,
  type AuditRecordMeta,
} from "@/src/audit/recordRetention";

export interface RetentionSafeguardPanelProps {
  policy: AuditRetentionPolicy;
  records: AuditRecordMeta[];
  now?: number;
  /** Optional external indicator that a payroll settlement is currently pending (#859). */
  settlementPending?: boolean;
  /** Optional callback to purge eligible records when all safeguards pass (#859). */
  onPurgePrunable?: (prunableRecordIds: string[]) => void;
}

export function RetentionSafeguardPanel({
  policy,
  records,
  now,
  settlementPending,
  onPurgePrunable,
}: RetentionSafeguardPanelProps) {
  const effectiveNow = now ?? Date.now();
  const purgeGuard = evaluateRetentionPurgeGuard(records, policy, effectiveNow, {
    hasPendingSettlement: settlementPending,
  });
  const evaluation = settlementPending
    ? purgeGuard.evaluation
    : evaluateAuditRetention(records, policy, effectiveNow);

  const isSettlementBlocked =
    purgeGuard.blockerCode === "SETTLEMENT_PENDING" ||
    purgeGuard.blockerCode === "SETTLEMENT_UNVERIFIED";

  const handlePurgeClick = () => {
    if (!purgeGuard.purgeAllowed || !onPurgePrunable) return;
    onPurgePrunable(purgeGuard.purgableRecordIds);
  };

  return (
    <div
      data-testid="retention-safeguard-panel"
      data-policy-valid={evaluation.policyValid ? "true" : "false"}
      data-purge-allowed={purgeGuard.purgeAllowed ? "true" : "false"}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Archive className="h-5 w-5 text-amber-600" aria-hidden="true" />
          Audit Retention Safeguards
        </h2>
        <div className="flex items-center gap-2">
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
          {onPurgePrunable && (
            <button
              type="button"
              onClick={handlePurgeClick}
              disabled={!purgeGuard.purgeAllowed}
              data-testid="retention-purge-button"
              title={purgeGuard.primaryReason}
              className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${
                purgeGuard.purgeAllowed
                  ? "bg-amber-600 text-white border-amber-700 hover:bg-amber-700"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
            >
              {purgeGuard.purgeAllowed
                ? `Purge Prunable (${purgeGuard.purgableRecordIds.length})`
                : "Purge Disabled"}
            </button>
          )}
        </div>
      </div>

      {!evaluation.policyValid && (
        <div
          role="alert"
          data-testid="retention-policy-errors"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs"
        >
          <p className="font-semibold text-red-800 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Retention policy needs fixes
          </p>
          <ul className="mt-1 list-disc list-inside text-red-700 space-y-0.5">
            {evaluation.policyErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.policyValid && isSettlementBlocked && (
        <div
          role="status"
          data-testid="retention-settlement-pending-banner"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <p className="font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
            Retention purge disabled while settlement is pending
          </p>
          <p className="mt-1 text-amber-800">{purgeGuard.primaryReason}</p>
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

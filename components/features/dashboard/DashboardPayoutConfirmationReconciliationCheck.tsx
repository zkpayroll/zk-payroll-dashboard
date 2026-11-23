"use client";

import { CheckCircle2, ShieldAlert } from "lucide-react";
import {
  evaluatePayoutConfirmationReconciliation,
  type PayoutConfirmationStatus,
} from "@/lib/payroll/payoutConfirmationReconciliation";
import type { ReconciliationEntry } from "@/types/models";

export interface DashboardPayoutConfirmationReconciliationCheckProps {
  entries?: ReconciliationEntry[] | null;
  className?: string;
}

function toneClass(status: PayoutConfirmationStatus): string {
  return status === "attention" ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50";
}

export default function DashboardPayoutConfirmationReconciliationCheck({
  entries,
  className = "",
}: DashboardPayoutConfirmationReconciliationCheckProps) {
  const reconciliation = evaluatePayoutConfirmationReconciliation(entries ?? []);
  const needsAttention = reconciliation.status === "attention";

  return (
    <section
      role="status"
      aria-labelledby="dashboard-payout-confirmation-heading"
      className={`rounded-lg border p-4 transition-all ${toneClass(reconciliation.status)} ${className}`}
      data-testid="dashboard-payout-confirmation"
      data-status={reconciliation.status}
      data-confirmed-count={reconciliation.confirmedCount}
      data-discrepancy-count={reconciliation.discrepancyCount}
      data-missing-count={reconciliation.missingCount}
    >
      <div className="flex items-start gap-3">
        {needsAttention ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h3 id="dashboard-payout-confirmation-heading" className="text-sm font-semibold text-gray-900">
            Payout confirmation reconciliation
          </h3>
          <p
            className={`mt-1 text-sm ${needsAttention ? "text-amber-800" : "text-green-800"}`}
            data-testid="dashboard-payout-confirmation-summary"
          >
            {reconciliation.summaryMessage}
          </p>
          {needsAttention && (
            <p className="mt-2 text-xs text-amber-800">
              Unreconciled amount: {reconciliation.unreconciledAmount.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

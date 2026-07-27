"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertCircle, Clock, XCircle, ArrowRight } from "lucide-react";
import { MOCK_PAYROLL_RUNS, MOCK_TRANSACTIONS } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types/models";
import StatusBadge from "@/components/ui/StatusBadge";
import { ReconciliationBadge, ReconciliationSummary } from "@/components/features/payroll/ReconciliationBadge";
import Link from "next/link";

type SummaryMetrics = {
  totalRuns: number;
  reconciled: number;
  partial: number;
  pending: number;
  failed: number;
  totalExpected: number;
  totalActual: number;
  discrepancyCount: number;
};

function useReconciliationMetrics(runs: PayrollRun[]): SummaryMetrics {
  return useMemo(() => {
    const metrics: SummaryMetrics = {
      totalRuns: runs.length,
      reconciled: 0,
      partial: 0,
      pending: 0,
      failed: 0,
      totalExpected: 0,
      totalActual: 0,
      discrepancyCount: 0,
    };

    for (const run of runs) {
      const reconciliationStatus = run.reconciliationStatus || "pending";
      if (reconciliationStatus === "complete") metrics.reconciled++;
      else if (reconciliationStatus === "partial") metrics.partial++;
      else if (reconciliationStatus === "failed") metrics.failed++;
      else metrics.pending++;
      metrics.totalExpected += run.totalAmount;

      if (reconciliationStatus === "complete") {
        metrics.totalActual += run.totalAmount;
      } else if (reconciliationStatus === "partial" && run.reconciliationDetails) {
        metrics.totalActual +=
          (run.reconciliationDetails.processedCount / run.reconciliationDetails.totalCount) *
          run.totalAmount;
      }

      if (run.reconciliationDetails?.discrepancies) {
        metrics.discrepancyCount += run.reconciliationDetails.discrepancies.length;
      }
    }

    return metrics;
  }, [runs]);
}

export default function ReconciliationPanel() {
  const runs = MOCK_PAYROLL_RUNS;
  const metrics = useReconciliationMetrics(runs);

  return (
    <section aria-labelledby="reconciliation-heading" className="space-y-6">
      <header>
        <h1
          id="reconciliation-heading"
          className="text-2xl font-semibold text-gray-900"
        >
          Reconciliation Summary
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare expected payroll outcomes with actual completed transactions and exceptions.
        </p>
      </header>

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <article className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Total Runs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.totalRuns}</p>
        </article>

        <article className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium uppercase">Fully Reconciled</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{metrics.reconciled}</p>
        </article>

        <article className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium uppercase">Needs Attention</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {metrics.partial + metrics.failed}
          </p>
        </article>

        <article className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <XCircle className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium uppercase">Discrepancies</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.discrepancyCount}</p>
        </article>
      </div>

      {/* Financial summary */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Expected Payout</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              ${metrics.totalExpected.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Actual Completed</p>
            <p className="mt-1 text-xl font-bold text-green-600">
              ${Math.round(metrics.totalActual).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Outstanding</p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              ${(metrics.totalExpected - Math.round(metrics.totalActual)).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Payroll runs reconciliation table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Payroll Run Reconciliation</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Detailed reconciliation status for each payroll run.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Reconciliation status per payroll run</caption>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Run ID</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Date</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Status</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Amount</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Reconciliation</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Progress</th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {run.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(run.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${run.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <ReconciliationBadge payrollRun={run} variant="compact" />
                  </td>
                  <td className="px-6 py-4 min-w-[140px]">
                    <ReconciliationSummary payrollRun={run} />
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/payroll/${run.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      View Details
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {runs.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No payroll runs available for reconciliation.
          </div>
        )}
      </div>

      {/* Exceptions section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Exceptions</h2>
        {(() => {
          const exceptions = MOCK_TRANSACTIONS.filter(
            (tx) => tx.status === "pending" || tx.status === "failed"
          );
          if (exceptions.length === 0) {
            return (
              <p className="text-sm text-gray-500">No exceptions — all items are clear.</p>
            );
          }
          return (
            <ul className="space-y-3">
              {exceptions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 p-4"
                >
                  {tx.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      Run {tx.id} — ${tx.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.status === "failed" ? "Transaction failed" : "Awaiting ZK proof"} ·{" "}
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          );
        })()}
      </div>
    </section>
  );
}
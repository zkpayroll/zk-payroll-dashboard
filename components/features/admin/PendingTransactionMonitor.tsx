"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock, ExternalLink, RotateCcw } from "lucide-react";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";

const STALE_MINUTES = 30;

function formatAge(iso: string): string {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
}

function explorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/public/tx/${txHash}`;
}

export default function PendingTransactionMonitor() {
  const pendingTransactions = useMemo(
    () =>
      MOCK_TRANSACTIONS.filter((tx) => tx.status === "pending" || tx.status === "failed").sort(
        (a, b) => b.timestamp.localeCompare(a.timestamp),
      ),
    [],
  );

  return (
    <section aria-labelledby="pending-transaction-monitor-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="pending-transaction-monitor-heading" className="text-lg font-semibold text-gray-900">
            Pending transaction monitor
          </h2>
          <p className="text-sm text-gray-600">
            Track confirmation status, timeout risk, and recovery actions for payroll submissions.
          </p>
        </div>
        <a
          href="/payroll/exceptions"
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Retry queue
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pendingTransactions.map((tx) => {
          const isStale = Math.max(
            0,
            Math.floor((Date.now() - new Date(tx.timestamp).getTime()) / 60000),
          ) > STALE_MINUTES;
          const explorerHref = tx.txHash ? explorerUrl(tx.txHash) : `/history?tx=${tx.id}`;

          return (
            <article
              key={tx.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Payroll {tx.id}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {tx.status}
                    </span>
                    {isStale && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        timeout risk
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {tx.employeeCount} employee(s) · ${tx.totalAmount.toLocaleString()} · {formatAge(tx.timestamp)}
                  </p>
                </div>
                <Clock className="h-4 w-4 text-gray-400" aria-hidden />
              </div>

              <p className="mt-3 text-sm text-gray-700">
                {tx.status === "pending"
                  ? "Waiting for chain confirmation. Retry if the transaction exceeds the expected confirmation window."
                  : "Submission failed. Review the run, then retry from the exceptions queue."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={explorerHref}
                  target={tx.txHash ? "_blank" : undefined}
                  rel={tx.txHash ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  View explorer
                </a>
                <a
                  href="/payroll/exceptions"
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Retry guidance
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

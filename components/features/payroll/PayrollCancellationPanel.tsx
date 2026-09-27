"use client";

import { XCircle, AlertTriangle, Clock, User, FileSearch, ArrowRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { PayrollRun } from "@/types/models";
import {
  getCancellationReason,
  getCancellationSummary,
  getCancellationDescription,
  getAvailableActions,
  sanitizeCancellationDetail,
} from "@/lib/payroll/cancellation";

export interface PayrollCancellationPanelProps {
  run: PayrollRun;
  className?: string;
}

/**
 * Payroll cancellation detail panel.
 * Explains why a batch was cancelled and what actions remain available,
 * without exposing private payroll values (amounts, salaries, commitments).
 */
export function PayrollCancellationPanel({ run, className = "" }: PayrollCancellationPanelProps) {
  if (run.status !== "cancelled") return null;

  const reason = getCancellationReason(run);
  const summary = getCancellationSummary(run);
  const description = getCancellationDescription(run);
  const actions = getAvailableActions(run);
  const detail = sanitizeCancellationDetail(run.cancellationDetail);
  const cancelledAt = run.cancelledAt ?? run.timestamp ?? run.createdAt;

  return (
    <section
      data-testid="payroll-cancellation-panel"
      aria-labelledby="cancellation-panel-heading"
      className={`rounded-xl border border-red-200 bg-red-50/40 overflow-hidden ${className}`}
    >
      <div className="bg-white border-b border-red-100 px-5 py-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
          <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
        </span>
        <div>
          <h2 id="cancellation-panel-heading" className="text-sm font-semibold text-red-900 flex items-center gap-2">
            Batch Cancelled
            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
              {reason.replace(/_/g, " ")}
            </span>
          </h2>
          <p className="text-sm text-red-800 mt-1">{summary}</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start gap-2 text-sm text-gray-700">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p data-testid="cancellation-description">{description}</p>
        </div>

        {detail && (
          <div className="rounded-md bg-white border border-red-100 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileSearch className="w-3.5 h-3.5" /> Additional detail
            </p>
            <p className="text-sm text-gray-700">{detail}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-white border p-3">
            <p className="text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Cancelled at
            </p>
            <p className="mt-1 font-medium text-gray-900">{cancelledAt ? new Date(cancelledAt).toLocaleString() : "—"}</p>
          </div>
          <div className="rounded-lg bg-white border p-3">
            <p className="text-gray-500 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Cancelled by
            </p>
            <p className="mt-1 font-medium text-gray-900 font-mono text-xs">{run.cancelledBy ?? "system"}</p>
          </div>
          <div className="rounded-lg bg-white border p-3">
            <p className="text-gray-500 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Run ID
            </p>
            <p className="mt-1 font-medium text-gray-900 font-mono text-xs truncate" title={run.id}>
              {run.id}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">What you can do next</h3>
          <ul className="space-y-1.5" aria-label="Available actions after cancellation">
            {actions.map((action, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {action}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Link
            href="/payroll/drafts"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            View drafts
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
          >
            View history
          </Link>
          {reason === "treasury_insufficient" && (
            <Link
              href="/treasury"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
            >
              Go to treasury
            </Link>
          )}
        </div>

        <p className="text-xs text-gray-500 pt-2 border-t">
          Privacy note: this panel never shows individual salary amounts or commitment values. All amounts remain redacted.
        </p>
      </div>
    </section>
  );
}

export default PayrollCancellationPanel;

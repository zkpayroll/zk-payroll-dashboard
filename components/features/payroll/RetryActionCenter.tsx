"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RefreshCw,
  XCircle,
  Clock,
  ArrowRight,
  FileWarning,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types";
import StatusBadge from "@/components/ui/StatusBadge";

type RetryableRun = PayrollRun & {
  retryReason: string;
  recoveryAction: string;
  recoveryLink: string;
  employees: string[];
};

const RETRY_REASONS: Record<string, { reason: string; action: string; link: string }> = {
  failed: {
    reason: "Transaction submission failed — network or contract error",
    action: "Review error and retry submission via payroll wizard",
    link: "/payroll/execute",
  },
  pending: {
    reason: "ZK proof not yet generated or proof expired",
    action: "Generate a new ZK proof before submission",
    link: "/payroll/execute",
  },
  cancelled: {
    reason: "Run was cancelled before completion",
    action: "Start a new payroll run with the same parameters",
    link: "/payroll/execute",
  },
};

export default function RetryActionCenter() {
  const retryableRuns = useMemo<RetryableRun[]>(() => {
    return MOCK_PAYROLL_RUNS
      .filter((run) => run.status === "failed" || run.status === "pending" || run.status === "cancelled")
      .map((run) => {
        const info = RETRY_REASONS[run.status] ?? {
          reason: "Unknown issue",
          action: "Contact support",
          link: "/incidents",
        };
        return {
          ...run,
          retryReason: info.reason,
          recoveryAction: info.action,
          recoveryLink: info.link,
          employees: MOCK_EMPLOYEES
            .filter((e) => run.employeeIds.includes(e.id))
            .map((e) => e.name),
        };
      });
  }, []);

  const failedCount = retryableRuns.filter((r) => r.status === "failed").length;
  const pendingCount = retryableRuns.filter((r) => r.status === "pending").length;

  if (retryableRuns.length === 0) {
    return (
      <section aria-labelledby="retry-center-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 id="retry-center-heading" className="text-lg font-semibold text-gray-900">
            All Clear
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            No retryable payroll failures at this time.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="retry-center-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="retry-center-heading" className="text-lg font-semibold text-gray-900">
            Retry Action Center
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {retryableRuns.length} run{retryableRuns.length !== 1 ? "s" : ""} requiring attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <XCircle className="w-3 h-3" />
              {failedCount} failed
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <Clock className="w-3 h-3" />
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Safe Recovery Guidance</p>
          <p className="text-amber-700 mt-0.5">
            Review each failed run below before retrying. Retrying a failed payroll run will create a
            new transaction — any previously submitted but unconfirmed transactions will be
            automatically cancelled on-chain. Verify the treasury balance is sufficient before
            re-submitting.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {retryableRuns.map((run) => (
          <div
            key={run.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      run.status === "failed"
                        ? "bg-red-100"
                        : run.status === "pending"
                        ? "bg-yellow-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {run.status === "failed" ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : run.status === "pending" ? (
                      <Clock className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <FileWarning className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Payroll Run {run.id}
                      </h3>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      ${run.totalAmount.toLocaleString()} &middot; {run.employeeCount} employee{run.employeeCount !== 1 ? "s" : ""} &middot;{" "}
                      {new Date(run.timestamp).toLocaleDateString()}
                    </p>
                    {run.employees.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-md">
                        {run.employees.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 uppercase mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Issue
                  </div>
                  <p className="text-xs text-red-600">{run.retryReason}</p>
                  {run.transactionHash && (
                    <p className="text-[10px] font-mono text-red-400 mt-1 truncate">
                      Tx: {run.transactionHash}
                    </p>
                  )}
                </div>
                <div className="bg-indigo-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase mb-1">
                    <RefreshCw className="w-3 h-3" />
                    Recovery
                  </div>
                  <p className="text-xs text-indigo-600">{run.recoveryAction}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/payroll/runs/${run.id}`}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  View details &rarr;
                </Link>
                <Link
                  href={run.recoveryLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry Now
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
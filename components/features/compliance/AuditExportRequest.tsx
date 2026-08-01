"use client";

import { useState, useMemo, useId } from "react";
import {
  FileDown,
  Filter,
  Database,
  AlertCircle,
  Info,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";
import { Button } from "@/components/ui/button";
import { useViewKeyStore } from "@/stores/viewKeys";
import { resolveDisabledExportReason } from "./AuditExportTooltips";
import type { AuditExportLevel } from "./AuditExportTooltips";
import type { UserRole } from "@/types/models";

/**
 * Tooltip wrapper for disabled controls in the audit export form (#207).
 *
 * Renders a tiny span around the child element and surfaces a safe,
 * role-agnostic explanation whenever the wrapped control is disabled.
 * Crucially, the tooltip text comes from a precomputed reason — it
 * never embeds sensitive identifiers (no key IDs, recipient addresses,
 * or grant IDs), per the issue's "without exposing restricted data"
 * constraint.
 */
function DisabledExplainer({
  reason,
  children,
}: {
  reason: { message: string } | null;
  children: React.ReactNode;
}) {
  const tipId = useId();

  if (!reason) return <>{children}</>;

  // The wrapped control is `disabled`, so keyboard users can never focus it
  // and the visual tooltip above is mouse-only. We mirror the message onto
  // the child's native `title` so screen readers and hover tooltip both
  // surface the same explanation without leaking restricted data.
  const tooltipId = tipId;

  return (
    <span
      className="relative inline-flex group/peer"
      title={reason.message}
      aria-describedby={tooltipId}
      data-testid="audit-export-disabled-explain"
    >
      {children}
      <span
        role="tooltip"
        id={tooltipId}
        data-testid="audit-export-disabled-reason"
        className="pointer-events-none absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-md bg-gray-900 text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover/peer:opacity-100 group-focus-within/peer:opacity-100 transition-opacity duration-150 shadow-lg"
      >
        <span className="flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{reason.message}</span>
        </span>
        <span
          aria-hidden="true"
          className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1"
        />
      </span>
    </span>
  );
}

export default function AuditExportRequest() {
  const [dateRange, setDateRange] = useState({ start: "2025-01-01", end: "2025-12-31" });
  const [level, setLevel] = useState<AuditExportLevel>("summary");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In this demo build there is no dedicated "current user" — admins and
  // auditors see a single workspace — so we treat the most-recent active
  // grant on this view-key store as the grant that governs exports. The
  // resolved role mirrors how the dashboard identifies the operator.
  const activeViewKeys = useViewKeyStore((s) => s.viewKeys);
  const activeGrant = useMemo(() => {
    const candidates = activeViewKeys.filter((k) => k.isActive);
    if (candidates.length === 0) return null;
    return candidates.slice().sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]!;
  }, [activeViewKeys]);

  // Demo role resolution: the admin page is admin-coded in nav, but the
  // export form runs wherever the user lands. We default to "admin" when a
  // full-audit grant is active so the demo flow doesn't gate itself, while
  // a read-only grant is treated as an auditor with 'read-only' scope.
  const resolvedRole: UserRole | null = useMemo(() => {
    if (!activeGrant) return "admin";
    return activeGrant.scope === "full-audit" ? "admin" : "auditor";
  }, [activeGrant]);

  const summaryDisabledReason = resolveDisabledExportReason({
    role: resolvedRole,
    level: "summary",
    activeGrant,
  });
  const fullDisabledReason = resolveDisabledExportReason({
    role: resolvedRole,
    level: "full",
    activeGrant,
  });

  // Mock calculation of scope based on date range
  const scopeDetails = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    const filtered = MOCK_TRANSACTIONS.filter((tx) => {
      const txDate = new Date(tx.timestamp);
      return txDate >= start && txDate <= end;
    });

    const totalAmount = filtered.reduce((sum, tx) => sum + tx.totalAmount, 0);
    const employeeCount = filtered.reduce((sum, tx) => sum + tx.employeeCount, 0);

    return {
      txCount: filtered.length,
      totalAmount,
      employeeCount,
      coveredPeriods: filtered.length > 0 ? "Annual/Quarterly" : "None",
    };
  }, [dateRange]);

  const submitDisabledReason = useMemo(() => {
    if (scopeDetails.txCount === 0)
      return { message: "No transactions in the selected range." };
    return resolveDisabledExportReason({
      role: resolvedRole,
      level,
      activeGrant,
    });
  }, [scopeDetails.txCount, resolvedRole, level, activeGrant]);

  const handleRequest = async () => {
    setIsSubmitting(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    toast.success("Audit Export Requested", {
      description: "Review team will process your request within 24 hours.",
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Configuration Form */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            Export Configuration
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start-date-input"
                  className="block text-xs font-semibold text-gray-400 uppercase mb-1.5"
                >
                  Start Date
                </label>
                <input
                  id="start-date-input"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="w-full rounded-md border-gray-200 text-sm focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date-input"
                  className="block text-xs font-semibold text-gray-400 uppercase mb-1.5"
                >
                  End Date
                </label>
                <input
                  id="end-date-input"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-full rounded-md border-gray-200 text-sm focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Data Sensitivity Level
              </span>
              <div className="grid grid-cols-2 gap-3">
                <DisabledExplainer reason={summaryDisabledReason}>
                  <button
                    type="button"
                    onClick={() => setLevel("summary")}
                    aria-disabled={summaryDisabledReason !== null}
                    disabled={summaryDisabledReason !== null}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      level === "summary"
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                        : "border-gray-200 hover:border-gray-300"
                    } ${summaryDisabledReason ? "opacity-60 cursor-not-allowed" : ""}`}
                    data-testid="audit-export-level-summary"
                  >
                    <p className="text-sm font-bold text-gray-900">Summary Only</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Aggregated totals and counts for reporting.
                    </p>
                  </button>
                </DisabledExplainer>
                <DisabledExplainer reason={fullDisabledReason}>
                  <button
                    type="button"
                    onClick={() => setLevel("full")}
                    aria-disabled={fullDisabledReason !== null}
                    disabled={fullDisabledReason !== null}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      level === "full"
                        ? "border-amber-600 bg-amber-50/50 ring-1 ring-amber-600"
                        : "border-gray-200 hover:border-gray-300"
                    } ${fullDisabledReason ? "opacity-60 cursor-not-allowed" : ""}`}
                    data-testid="audit-export-level-full"
                  >
                    <p className="text-sm font-bold text-gray-900">
                      Full Audit
                      {fullDisabledReason && (
                        <span className="ml-8">
                          <Lock
                            className="w-3 h-3 inline-block text-gray-400"
                            aria-hidden="true"
                          />
                          <span className="sr-only"> (disabled, see tooltip)</span>
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Includes department and transaction breakdowns.
                    </p>
                  </button>
                </DisabledExplainer>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 flex gap-3 border border-indigo-100">
          <Info className="w-5 h-5 text-indigo-600 shrink-0" />
          <p className="text-xs text-indigo-700 leading-relaxed">
            Requests are logged and reviewed for compliance with internal
            privacy policies.
            <strong> Full Audit</strong> exports require dual-approval from
            the Security Officer.
          </p>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="space-y-6">
        <div className="bg-gray-900 rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Database className="w-32 h-32" />
          </div>

          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">
            Scope Preview
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                  Expected Transactions
                </p>
                <p className="text-3xl font-bold">{scopeDetails.txCount}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                  Total Coverage
                </p>
                <p className="text-xl font-bold text-indigo-300">
                  ${scopeDetails.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                  Impacted Records
                </p>
                <p className="text-sm font-medium">
                  {scopeDetails.employeeCount} payment records
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">
                  Data Depth
                </p>
                <p
                  className={`text-sm font-medium ${
                    level === "full" ? "text-amber-400" : "text-green-400"
                  }`}
                >
                  {level === "full" ? "Sensitive Breakdown" : "Summary Aggregate"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <DisabledExplainer reason={submitDisabledReason}>
              <Button
                disabled={submitDisabledReason !== null}
                aria-disabled={submitDisabledReason !== null}
                onClick={handleRequest}
                className={`w-full py-6 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  level === "full"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-indigo-500 hover:bg-indigo-600 text-white"
                }`}
                data-testid="audit-export-submit"
              >
                {isSubmitting
                  ? "Processing…"
                  : level === "full"
                    ? "Confirm High-Sensitivity Request"
                    : "Submit Prepared Request"}
                {!isSubmitting && <FileDown className="w-4 h-4" />}
              </Button>
            </DisabledExplainer>
            {scopeDetails.txCount === 0 && (
              <p className="text-center text-[10px] text-red-400 mt-2 font-bold uppercase">
                No data found for the selected range
              </p>
            )}
          </div>
        </div>

        {level === "full" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 animate-in zoom-in duration-200">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase tracking-tighter">
                  Sensitive Scope Warning
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  You are requesting full transaction breakdowns. This action
                  will be flagged for secondary review and added to the
                  immutable audit log.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

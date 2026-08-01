"use client";

import { useState, useMemo } from "react";
import {
  Lock,
  Unlock,
  AlertTriangle,
  Banknote,
  UserCheck,
  ShieldAlert,
  RefreshCw,
  Network,
  Hand,
  FileSearch,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MOCK_PAYROLL_LOCKS } from "@/lib/api/mockData";
import type { PayrollLockReasonType } from "@/types";

// ─── Reason-type metadata ────────────────────────────────────────────────────

const LOCK_REASON_META: Record<
  PayrollLockReasonType,
  { icon: typeof Lock; label: string; color: string }
> = {
  insufficient_treasury: {
    icon: Banknote,
    label: "Insufficient Treasury",
    color: "text-red-600",
  },
  pending_approval: {
    icon: UserCheck,
    label: "Pending Approval",
    color: "text-amber-600",
  },
  zk_proof_failed: {
    icon: ShieldAlert,
    label: "ZK Proof Failed",
    color: "text-red-600",
  },
  employee_data_changed: {
    icon: RefreshCw,
    label: "Employee Data Changed",
    color: "text-amber-600",
  },
  network_error: {
    icon: Network,
    label: "Network Error",
    color: "text-red-600",
  },
  manual_freeze: {
    icon: Hand,
    label: "Manual Freeze",
    color: "text-blue-600",
  },
  compliance_hold: {
    icon: FileSearch,
    label: "Compliance Hold",
    color: "text-purple-600",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortAddress(pk: string): string {
  if (pk === "system") return "System";
  return `${pk.slice(0, 6)}...${pk.slice(-4)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

function PayrollLockReasonViewer() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const locks = useMemo(() => {
    if (filter === "active") return MOCK_PAYROLL_LOCKS.filter((l) => !l.isResolved);
    if (filter === "resolved") return MOCK_PAYROLL_LOCKS.filter((l) => l.isResolved);
    return MOCK_PAYROLL_LOCKS;
  }, [filter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section aria-labelledby="lock-reason-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          id="lock-reason-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Payroll Lock Reasons
        </h2>
        <div className="flex gap-2">
          {(["all", "active", "resolved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {locks.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Unlock className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">No locks found</p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === "active"
              ? "All payroll runs are currently active."
              : filter === "resolved"
                ? "No resolved locks to display."
                : "No payroll locks recorded."}
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {locks.map((lock) => {
          const meta = LOCK_REASON_META[lock.reasonType];
          const ReasonIcon = meta.icon;
          const isExpanded = expandedId === lock.id;

          return (
            <li
              key={lock.id}
              className={`bg-white rounded-lg shadow-sm border-l-4 ${
                lock.isResolved ? "border-l-green-500" : "border-l-red-500"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(lock.id)}
                className="w-full flex items-center justify-between p-4 text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      lock.isResolved ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    {lock.isResolved ? (
                      <Unlock className="w-4 h-4 text-green-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ReasonIcon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {meta.label}
                      </span>
                      {lock.isResolved ? (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Resolved
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Payroll {lock.payrollId} &middot;{" "}
                      {formatDate(lock.lockedAt)}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <div className="mt-3 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Reason
                      </p>
                      <p className="text-sm text-gray-900">
                        {lock.reasonDescription}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Locked By
                        </p>
                        <p className="text-sm font-mono text-gray-900">
                          {shortAddress(lock.lockedBy)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                          Locked At
                        </p>
                        <p className="text-sm text-gray-900">
                          {formatDate(lock.lockedAt)}
                        </p>
                      </div>
                    </div>

                    {lock.isResolved && lock.resolvedAt && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">
                            Resolved At
                          </p>
                          <p className="text-sm text-green-800">
                            {formatDate(lock.resolvedAt)}
                          </p>
                        </div>
                        {lock.resolvedBy && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">
                              Resolved By
                            </p>
                            <p className="text-sm font-mono text-green-800">
                              {shortAddress(lock.resolvedBy)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`rounded-lg p-3 border ${
                        lock.isResolved
                          ? "bg-green-50 border-green-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            lock.isResolved
                              ? "text-green-600"
                              : "text-amber-600"
                          }`}
                        />
                        <div>
                          <p className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                            Resolution Action
                          </p>
                          <p
                            className={`text-sm ${
                              lock.isResolved
                                ? "text-green-800"
                                : "text-amber-800"
                            }`}
                          >
                            {lock.resolutionAction}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default PayrollLockReasonViewer;
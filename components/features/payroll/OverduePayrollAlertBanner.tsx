"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  X,
  Clock,
  DollarSign,
  Users,
  ChevronRight,
} from "lucide-react";
import { MOCK_OVERDUE_ALERTS } from "@/lib/api/mockData";
import type { OverdueAlertSeverity } from "@/types";

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  OverdueAlertSeverity,
  {
    icon: typeof AlertTriangle;
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-800",
    iconColor: "text-red-500",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-800",
    iconColor: "text-amber-500",
    label: "Warning",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

function OverduePayrollAlertBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleAlerts = useMemo(
    () => MOCK_OVERDUE_ALERTS.filter((a) => !dismissedIds.has(a.id)),
    [dismissedIds],
  );

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const dismissAll = () => {
    setDismissedIds(
      new Set(MOCK_OVERDUE_ALERTS.map((a) => a.id)),
    );
  };

  if (visibleAlerts.length === 0) return null;

  // Sort: critical first, then by daysOverdue descending
  const sorted = [...visibleAlerts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.daysOverdue - a.daysOverdue;
  });

  return (
    <section
      aria-labelledby="overdue-alerts-heading"
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <h2 id="overdue-alerts-heading" className="sr-only">
          Overdue Payroll Alerts
        </h2>
        {visibleAlerts.length > 1 && (
          <button
            type="button"
            onClick={dismissAll}
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            Dismiss all
          </button>
        )}
      </div>

      <div className="space-y-2" role="list">
        {sorted.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity];
          const SeverityIcon = config.icon;

          return (
            <div
              key={alert.id}
              role="listitem"
              className={`${config.bg} border-l-4 ${config.border} rounded-r-lg p-4 shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <SeverityIcon
                  className={`w-5 h-5 mt-0.5 shrink-0 ${config.iconColor}`}
                  aria-hidden="true"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold ${config.text}`}
                    >
                      {alert.payrollName}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        alert.severity === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {alert.daysOverdue} day
                      {alert.daysOverdue !== 1 ? "s" : ""} overdue
                    </span>
                  </div>

                  <p className={`text-sm mt-1 ${config.text}`}>
                    {alert.reason}
                  </p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {alert.totalAmount.toLocaleString()} XLM
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {alert.employeeCount} employee
                      {alert.employeeCount !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Due: {formatDate(alert.dueDate)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={`/payroll/execute`}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                        alert.severity === "critical"
                          ? "text-red-600 hover:text-red-700"
                          : "text-amber-600 hover:text-amber-700"
                      }`}
                    >
                      View payroll
                      <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(alert.id)}
                  className={`p-1 rounded-md transition-colors shrink-0 ${
                    alert.severity === "critical"
                      ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                      : "text-amber-400 hover:text-amber-600 hover:bg-amber-100"
                  }`}
                  aria-label={`Dismiss alert for ${alert.payrollName}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default OverduePayrollAlertBanner;
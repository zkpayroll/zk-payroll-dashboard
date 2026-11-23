"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Building2,
  ChevronRight,
  X,
} from "lucide-react";
import type { InactiveCompanyWarningEvaluation } from "@/lib/payroll/inactiveCompanyWarning";
import { cn } from "@/lib/utils";

export interface InactiveCompanyWarningBannerProps {
  evaluation: InactiveCompanyWarningEvaluation;
  className?: string;
  onDismiss?: () => void;
}

export function InactiveCompanyWarningBanner({
  evaluation,
  className,
  onDismiss,
}: InactiveCompanyWarningBannerProps) {
  if (!evaluation.hasWarning) {
    return null;
  }

  const isCritical = evaluation.severity === "critical";

  return (
    <div
      role="alert"
      aria-live={isCritical ? "assertive" : "polite"}
      data-testid="inactive-company-payroll-warning"
      data-warning-code={evaluation.code}
      className={cn(
        "rounded-lg border p-4 transition-all duration-200",
        isCritical
          ? "bg-rose-50/90 border-rose-200 text-rose-900"
          : "bg-amber-50/90 border-amber-200 text-amber-900",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {isCritical ? (
            <ShieldAlert className="w-5 h-5 text-rose-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              data-testid="inactive-company-warning-title"
              className={cn(
                "text-sm font-semibold tracking-tight",
                isCritical ? "text-rose-900" : "text-amber-900",
              )}
            >
              {evaluation.title || "Inactive Company Reference"}
            </h3>
            {evaluation.code && (
              <span
                data-testid="inactive-company-warning-badge"
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium",
                  isCritical
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800",
                )}
              >
                <Building2 className="w-3 h-3" />
                {evaluation.code}
              </span>
            )}
            {evaluation.companyId && (
              <span className="text-xs text-gray-500 font-mono">
                ({evaluation.companyId})
              </span>
            )}
          </div>

          <p
            data-testid="inactive-company-warning-message"
            className="text-sm mt-1.5 leading-relaxed text-gray-700"
          >
            {evaluation.message}
          </p>

          {evaluation.nextSteps && evaluation.nextSteps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Recommended Actions:
              </p>
              <ul className="space-y-1">
                {evaluation.nextSteps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-1.5 text-xs text-gray-600"
                  >
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-gray-400 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.actionHref && evaluation.actionLabel && (
            <div className="mt-3 flex items-center gap-3">
              <Link
                href={evaluation.actionHref}
                data-testid="inactive-company-warning-action"
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors",
                  isCritical
                    ? "bg-rose-600 text-white hover:bg-rose-700 focus:ring-2 focus:ring-rose-500"
                    : "bg-amber-600 text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500",
                )}
              >
                {evaluation.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InactiveCompanyWarningBanner;

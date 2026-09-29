"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  evaluateAssetAvailabilitySafety,
} from "@/lib/assets/assetAvailabilitySafety";
import type { ConfiguredAssetItem } from "@/types/assets";
import { useTreasuryStore } from "@/stores/treasury";

export interface DashboardAssetAvailabilityCheckProps {
  configuredAssets?: ConfiguredAssetItem[] | null;
  onConfigureClick?: () => void;
  className?: string;
}

/**
 * A privacy-safe dashboard safety check that confirms payroll has at least
 * one supported Stellar asset configured before disbursements can proceed.
 *
 * Surfaced on the main operations dashboard to give operators early visibility
 * into asset readiness, preventing blocked runs at payroll execution time.
 */
export default function DashboardAssetAvailabilityCheck({
  configuredAssets,
  onConfigureClick,
  className = "",
}: DashboardAssetAvailabilityCheckProps) {
  // If configuredAssets is explicitly passed (even null or []), use it.
  // Otherwise, derive configured assets from the treasury store or company state.
  const resolvedAssets =
    configuredAssets !== undefined
      ? configuredAssets
      : Object.keys(useTreasuryStore.getState().balances).map((code) => ({ code }));

  const safetyResult = evaluateAssetAvailabilitySafety(resolvedAssets);
  const isAvailable = safetyResult.status === "available";
  const isWarning = safetyResult.status === "warning";
  const isBlocked = safetyResult.status === "blocked";

  // Data status: "available" when fully ready, "unavailable" when blocked.
  // When in warning state, it still satisfies readiness but alerts the operator.
  const dataStatus = isBlocked ? "unavailable" : isWarning ? "warning" : "available";

  const borderColor = isBlocked
    ? "border-amber-200 bg-amber-50"
    : isWarning
      ? "border-amber-200 bg-amber-50"
      : "border-green-200 bg-green-50";

  return (
    <section
      role="status"
      aria-labelledby="dashboard-asset-availability-heading"
      className={`rounded-lg border p-4 transition-all ${borderColor} ${className}`}
      data-testid="dashboard-asset-availability"
      data-status={dataStatus}
      data-can-execute={safetyResult.canExecutePayroll ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        {isBlocked ? (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
        ) : isWarning ? (
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-asset-availability-heading"
              className="text-sm font-semibold text-gray-900"
            >
              Payroll asset availability
            </h3>
            {isBlocked && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Action Required
              </span>
            )}
            {isWarning && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Notice
              </span>
            )}
            {isAvailable && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Ready
              </span>
            )}
          </div>

          {/* Description & Status Details */}
          {isAvailable && (
            <p className="mt-1 text-sm text-green-800">
              {safetyResult.summaryMessage}
            </p>
          )}

          {isWarning && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-amber-800">
                {safetyResult.summaryMessage}
              </p>
              {safetyResult.warnings.map((warning, idx) => (
                <p key={idx} className="text-xs text-amber-700">
                  {warning}
                </p>
              ))}
            </div>
          )}

          {isBlocked && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-amber-800">
                {safetyResult.summaryMessage}
              </p>
              {safetyResult.unsupportedAssets.length > 0 && (
                <p className="text-xs text-amber-700">
                  Unsupported assets ignored: {safetyResult.unsupportedAssets.join(", ")}.
                </p>
              )}
              {safetyResult.invalidAssets.length > 0 && (
                <p className="text-xs text-amber-700">
                  {safetyResult.invalidAssets.length} invalid asset configuration(s) detected and rejected.
                </p>
              )}
            </div>
          )}

          {/* Action Link / Button */}
          {(isBlocked || isWarning) && safetyResult.remediationAction && (
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={safetyResult.remediationAction.href}
                onClick={(e) => {
                  if (onConfigureClick) {
                    e.preventDefault();
                    onConfigureClick();
                  }
                }}
                className="inline-flex text-sm font-medium text-amber-900 underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 rounded"
              >
                {safetyResult.remediationAction.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

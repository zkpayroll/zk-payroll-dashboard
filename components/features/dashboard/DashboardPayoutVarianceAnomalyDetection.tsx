"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { validatePayrollVariance } from "@/lib/validation/payrollVariance";
import type { PayrollVarianceValidationResult } from "@/lib/validation/payrollVariance";
import { useApprovalQueueStore } from "@/stores/approvalQueue";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

export interface DashboardPayoutVarianceAnomalyDetectionProps {
  expectedTotal?: number;
  actualTotal?: number;
  threshold?: number;
  onConfigureClick?: () => void;
  className?: string;
}

const DEFAULT_THRESHOLD = 500;

function getDefaultResult(): PayrollVarianceValidationResult {
  return {
    isValid: true,
    variance: 0,
    message: null,
  };
}

export default function DashboardPayoutVarianceAnomalyDetection({
  expectedTotal,
  actualTotal,
  threshold = DEFAULT_THRESHOLD,
  onConfigureClick,
  className = "",
}: DashboardPayoutVarianceAnomalyDetectionProps) {
  const approvalRuns = useApprovalQueueStore((s) => s.drafts);
  const latestApprovalRun = approvalRuns[approvalRuns.length - 1];
  const latestMockRun = MOCK_PAYROLL_RUNS[MOCK_PAYROLL_RUNS.length - 1];

  const resolvedExpectedTotal =
    expectedTotal !== undefined ? expectedTotal : latestApprovalRun?.totalAmount ?? latestMockRun?.totalAmount ?? null;
  const resolvedActualTotal = actualTotal !== undefined ? actualTotal : latestMockRun?.totalAmount ?? null;

  let result: PayrollVarianceValidationResult = getDefaultResult();
  let hasData = false;

  if (resolvedExpectedTotal !== null && resolvedActualTotal !== null) {
    result = validatePayrollVariance(resolvedExpectedTotal, resolvedActualTotal, threshold);
    hasData = true;
  }

  const isAnomaly = !result.isValid && hasData;
  const isWarning = result.variance > threshold * 0.8 && result.isValid && hasData;
  const isHealthy = result.isValid && !isWarning && hasData;
  const isNoData = !hasData;

  const statusColor = isAnomaly
    ? "border-amber-200 bg-amber-50"
    : isWarning
    ? "border-amber-200 bg-amber-50"
    : isHealthy
    ? "border-green-200 bg-green-50"
    : "border-gray-200 bg-gray-50";

  const statusLabel = isAnomaly
    ? "Anomaly Detected"
    : isWarning
    ? "Notice"
    : isHealthy
    ? "Normal"
    : "No Data";

  const statusIcon = isAnomaly
    ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
    : isWarning
    ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
    : isHealthy
    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
    : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />

  const statusBadgeClass = isAnomaly
    ? "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
    : isWarning
    ? "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
    : isHealthy
    ? "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
    : "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800";

  const defaultRemediation = {
    label: "Review payroll variance settings",
    href: "/settings/payroll-variance",
  };

  return (
    <section
      role={isAnomaly ? "alert" : "status"}
      aria-labelledby="dashboard-payout-variance-heading"
      className={`rounded-lg border p-4 transition-all ${statusColor} ${className}`}
      data-testid="dashboard-payout-variance-anomaly"
      data-status={isAnomaly ? "anomaly" : isWarning ? "warning" : isHealthy ? "healthy" : "no-data"}
      data-has-data={hasData ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        {statusIcon}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-payout-variance-heading"
              className="text-sm font-semibold text-gray-900"
            >
              Payout Variance Anomaly Detection
            </h3>
            <span className={statusBadgeClass}>{statusLabel}</span>
          </div>

          {isNoData && (
            <p className="mt-1 text-sm text-gray-600">
              No payroll run data available to evaluate variance. Configure expected and actual totals to enable detection.
            </p>
          )}

          {isHealthy && (
            <p className="mt-1 text-sm text-green-800">
              Payout variance of {result.variance.toLocaleString()} is within the configured threshold of {threshold.toLocaleString()}.
            </p>
          )}

          {isWarning && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-amber-800">
                Payout variance of {result.variance.toLocaleString()} is approaching the configured threshold of {threshold.toLocaleString()}.
              </p>
              <p className="text-xs text-amber-700">
                Monitor closely to ensure variance remains within acceptable bounds.
              </p>
            </div>
          )}

          {isAnomaly && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-amber-800">
                {result.message}
              </p>
              <p className="text-xs text-amber-700">
                Expected: {resolvedExpectedTotal?.toLocaleString()} | Actual: {resolvedActualTotal?.toLocaleString()} | Variance: {result.variance.toLocaleString()} | Threshold: {threshold.toLocaleString()}
              </p>
            </div>
          )}

          {(isAnomaly || isWarning) && (
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={defaultRemediation.href}
                onClick={(e) => {
                  if (onConfigureClick) {
                    e.preventDefault();
                    onConfigureClick();
                  }
                }}
                className="inline-flex text-sm font-medium text-amber-900 underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 rounded"
              >
                {defaultRemediation.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
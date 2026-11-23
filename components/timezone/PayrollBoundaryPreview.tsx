"use client";

import { CalendarClock, ArrowRight } from "lucide-react";
import { useTimezonePreferenceStore } from "@/stores/timezonePreference";
import { resolveDisplayTimeZone } from "@/lib/payroll/timezoneDisplay";
import {
  describePayrollTimezoneBoundary,
  evaluatePayrollTimezoneBoundary,
} from "@/lib/payroll/timezoneBoundaries";

const SAMPLE_WINDOW = {
  startUtc: "2026-01-15T00:00:00Z",
  endUtc: "2026-01-31T23:59:59Z",
};

export interface PayrollBoundaryPreviewProps {
  startUtc?: string;
  endUtc?: string;
  timeZone?: string;
  className?: string;
}

export default function PayrollBoundaryPreview({
  startUtc = SAMPLE_WINDOW.startUtc,
  endUtc = SAMPLE_WINDOW.endUtc,
  timeZone,
  className = "",
}: PayrollBoundaryPreviewProps) {
  const mode = useTimezonePreferenceStore((s) => s.mode);
  const organizationTimeZone = useTimezonePreferenceStore((s) => s.organizationTimeZone);

  const resolvedTimeZone = timeZone ?? resolveDisplayTimeZone({ mode, organizationTimeZone });
  const evaluation = evaluatePayrollTimezoneBoundary({ startUtc, endUtc, timeZone: resolvedTimeZone });

  if (!evaluation.valid) {
    return (
      <section
        role="alert"
        aria-labelledby="payroll-boundary-preview-heading"
        data-testid="payroll-boundary-preview"
        data-valid="false"
        className={`rounded-xl border border-red-200 bg-red-50 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <h3 id="payroll-boundary-preview-heading" className="text-sm font-semibold text-red-900">
              Payroll period boundary
            </h3>
            <p className="mt-1 text-sm text-red-700" data-testid="payroll-boundary-error">
              {evaluation.error}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const shiftsAcrossDay =
    evaluation.startShiftedAcrossDay || evaluation.endShiftedAcrossDay;

  return (
    <section
      role="status"
      aria-labelledby="payroll-boundary-preview-heading"
      data-testid="payroll-boundary-preview"
      data-valid="true"
      data-shifted={shiftsAcrossDay ? "true" : "false"}
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="payroll-boundary-preview-heading" className="text-sm font-semibold text-gray-900">
              Payroll period boundary
            </h3>
            {shiftsAcrossDay && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                Date shifts at boundary
              </span>
            )}
          </div>

          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Window in UTC
              </dt>
              <dd
                className="mt-1 text-sm text-gray-900"
                data-testid="payroll-boundary-utc"
              >
                {evaluation.startUtcDateKey} <ArrowRight className="inline h-3 w-3" aria-hidden="true" />{" "}
                {evaluation.endUtcDateKey}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Window in {evaluation.timeZone}
              </dt>
              <dd
                className="mt-1 text-sm text-gray-900"
                data-testid="payroll-boundary-zone"
              >
                {evaluation.startZoneDateKey} <ArrowRight className="inline h-3 w-3" aria-hidden="true" />{" "}
                {evaluation.endZoneDateKey}
              </dd>
            </div>
          </dl>

          <p
            className="mt-3 text-xs leading-5 text-gray-600"
            data-testid="payroll-boundary-note"
          >
            {describePayrollTimezoneBoundary(evaluation)}
          </p>
        </div>
      </div>
    </section>
  );
}

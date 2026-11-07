"use client";

import React from "react";
import {
  CalendarRange,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  explainAdjacentPeriodBoundaries,
  type PayrollPeriodBoundary,
  type AdjacentPeriodBoundaryExplanation,
} from "@/lib/audit/adjacentPeriodBoundaries";

export interface AdjacentPeriodBoundariesCardProps {
  periodA?: PayrollPeriodBoundary;
  periodB?: PayrollPeriodBoundary;
  explanation?: AdjacentPeriodBoundaryExplanation;
  className?: string;
}

const DEFAULT_PERIOD_A: PayrollPeriodBoundary = {
  periodId: "period_2026_09",
  periodLabel: "September 2026",
  startUtc: "2026-09-01T00:00:00.000Z",
  endUtc: "2026-10-01T00:00:00.000Z",
};

const DEFAULT_PERIOD_B: PayrollPeriodBoundary = {
  periodId: "period_2026_10",
  periodLabel: "October 2026",
  startUtc: "2026-10-01T00:00:00.000Z",
  endUtc: "2026-11-01T00:00:00.000Z",
};

export function AdjacentPeriodBoundariesCard({
  periodA = DEFAULT_PERIOD_A,
  periodB = DEFAULT_PERIOD_B,
  explanation: customExplanation,
  className = "",
}: AdjacentPeriodBoundariesCardProps) {
  const result =
    customExplanation ?? explainAdjacentPeriodBoundaries(periodA, periodB);

  const getStatusBadge = () => {
    switch (result.relationship) {
      case "continuous":
        return (
          <span
            data-testid="boundary-status-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Continuous Boundaries
          </span>
        );
      case "overlap":
        return (
          <span
            data-testid="boundary-status-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Overlapping Periods
          </span>
        );
      case "gap":
        return (
          <span
            data-testid="boundary-status-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Uncovered Gap
          </span>
        );
      default:
        return (
          <span
            data-testid="boundary-status-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200"
          >
            <Info className="w-3.5 h-3.5 text-gray-500" /> Invalid Boundary
          </span>
        );
    }
  };

  return (
    <div
      data-testid="audit-adjacent-period-boundaries"
      className={`rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3 text-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-indigo-600" />
          <h4 className="font-bold text-gray-900 text-sm">
            Adjacent Period Boundaries & Boundary Rule
          </h4>
        </div>
        {getStatusBadge()}
      </div>

      {/* Interval Demonstration */}
      <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-700 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-indigo-700">{periodA.periodLabel}:</span>
            <span data-testid="interval-a" className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {result.periodAInterval}
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-indigo-700">{periodB.periodLabel}:</span>
            <span data-testid="interval-b" className="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {result.periodBInterval}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-1.5 text-gray-600">
          <p data-testid="boundary-summary" className="font-medium text-gray-900">
            {result.summary}
          </p>
          <p data-testid="boundary-resolution" className="text-gray-500 text-[11px] leading-relaxed">
            <strong>Rule:</strong> {result.boundaryResolution}
          </p>
        </div>
      </div>

      {/* Zero Knowledge Privacy Notice */}
      <div className="flex items-start gap-2 text-[11px] text-gray-500 pt-1">
        <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
        <p data-testid="boundary-privacy-guarantee">{result.privacyGuarantee}</p>
      </div>
    </div>
  );
}

export default AdjacentPeriodBoundariesCard;

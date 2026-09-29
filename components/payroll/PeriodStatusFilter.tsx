"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Calendar,
  FileEdit,
  Lock,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import {
  DEFAULT_PERIOD_STATUS_FILTER,
  MOCK_PAYROLL_PERIODS,
  PAYROLL_PERIOD_STATUSES,
  PERIOD_STATUS_LABELS,
  countPeriodsByStatus,
  describePeriodFilterResult,
  filterPeriodsByStatus,
  normalizePeriodStatusFilter,
  type PayrollPeriod,
  type PayrollPeriodStatus,
  type PeriodStatusFilter,
} from "@/src/payroll/periodStatusFilter";

export interface PeriodStatusFilterProps {
  /** Periods to filter. Defaults to the safe demo fixture. */
  periods?: readonly PayrollPeriod[];
  /**
   * Initial filter value. Validated through `normalizePeriodStatusFilter`, so
   * an unknown value (e.g. a stale URL query) falls back to showing all
   * periods instead of throwing.
   */
  initialStatus?: unknown;
  /** Notified whenever the active filter changes. */
  onFilterChange?: (status: PeriodStatusFilter) => void;
  className?: string;
}

const STATUS_ICONS: Record<PayrollPeriodStatus, LucideIcon> = {
  draft: FileEdit,
  active: PlayCircle,
  finalized: Lock,
  archived: Archive,
};

const STATUS_BADGE_CLASSES: Record<PayrollPeriodStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  active: "bg-indigo-100 text-indigo-800 border-indigo-300",
  finalized: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archived: "bg-slate-100 text-slate-700 border-slate-300",
};

/**
 * Payroll period status filter (issue #453).
 *
 * Lets payroll teams narrow the period list by draft, active, finalized, and
 * archived status. Renders lifecycle labels and counts only — never amounts,
 * employee data, wallets, or hashes.
 */
export function PeriodStatusFilter({
  periods = MOCK_PAYROLL_PERIODS,
  initialStatus,
  onFilterChange,
  className = "",
}: PeriodStatusFilterProps) {
  const [status, setStatus] = useState<PeriodStatusFilter>(() =>
    normalizePeriodStatusFilter(initialStatus),
  );

  const counts = useMemo(() => countPeriodsByStatus(periods), [periods]);
  const filteredPeriods = useMemo(
    () => filterPeriodsByStatus(periods, status),
    [periods, status],
  );

  const selectStatus = (next: PeriodStatusFilter) => {
    setStatus(next);
    onFilterChange?.(next);
  };

  const options: Array<{ value: PeriodStatusFilter; label: string }> = [
    { value: "all", label: "All" },
    ...PAYROLL_PERIOD_STATUSES.map((value) => ({
      value,
      label: PERIOD_STATUS_LABELS[value],
    })),
  ];

  return (
    <section
      aria-labelledby="payroll-period-list-heading"
      data-testid="period-status-filter"
      className={`space-y-4 ${className}`}
    >
      <div>
        <h2
          id="payroll-period-list-heading"
          className="text-lg font-semibold text-gray-900"
        >
          Payroll Periods
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Narrow the period list by its current lifecycle status.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Filter by status
          </legend>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Filter payroll periods by status"
          >
            {options.map((option) => {
              const selected = status === option.value;
              const isStatus = option.value !== "all";
              const Icon = isStatus
                ? STATUS_ICONS[option.value as PayrollPeriodStatus]
                : Calendar;
              const count = counts[option.value];

              return (
                <label
                  key={option.value}
                  data-period-status-option={option.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${
                    selected
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="period-status-filter"
                    value={option.value}
                    checked={selected}
                    onChange={() => selectStatus(option.value)}
                    className="sr-only"
                    aria-label={`${option.label} (${count} period${
                      count === 1 ? "" : "s"
                    })`}
                  />
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      selected ? "text-white" : "text-gray-500"
                    }`}
                    aria-hidden="true"
                  />
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] leading-4 ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p
          className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600"
          role="status"
        >
          {describePeriodFilterResult(counts, status, filteredPeriods.length)}
        </p>
      </div>

      {filteredPeriods.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <EmptyState
            icon={Calendar}
            title={
              status === "all"
                ? "No payroll periods yet"
                : `No ${PERIOD_STATUS_LABELS[status].toLowerCase()} periods`
            }
            description={
              status === "all"
                ? "Payroll periods will appear here once a run has been created."
                : "No periods currently have this status. Choose another status or show every period."
            }
            action={{
              label: "Show all periods",
              onClick: () => selectStatus(DEFAULT_PERIOD_STATUS_FILTER),
            }}
          />
        </div>
      ) : (
        <ul className="space-y-2" data-testid="period-status-list">
          {filteredPeriods.map((period) => (
            <li
              key={period.id}
              data-testid={`payroll-period-${period.id}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {period.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {typeof period.runCount === "number"
                    ? `${period.runCount} payroll run${
                        period.runCount === 1 ? "" : "s"
                      }`
                    : "Run count unavailable"}
                  {period.updatedAt
                    ? ` · Updated ${new Date(
                        period.updatedAt,
                      ).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <span
                className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                  STATUS_BADGE_CLASSES[period.status]
                }`}
              >
                {PERIOD_STATUS_LABELS[period.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PeriodStatusFilter;

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileEdit, Lock, XCircle, CheckCircle2 } from "lucide-react";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollTransaction } from "@/types/models";
import { formatRunPeriod } from "@/lib/payrollSearch";
import {
  derivePeriodSummary,
  isPeriodSummaryEmpty,
  type PeriodStatusCounts,
} from "@/lib/payrollPeriodSummary";
import EmptyState from "@/components/ui/EmptyState";

interface PeriodSummaryCardProps {
  /** Transactions belonging to a single payroll period. Defaults to demo data. */
  transactions?: PayrollTransaction[];
  /** Explicit period label; derived from the first transaction's date if omitted. */
  periodLabel?: string;
  /** Where "View period" links to. Defaults to the payroll history/schedule view. */
  periodHref?: string;
  /** Skips the built-in loading delay — pass real async data straight through. */
  isLoading?: boolean;
  /** Explicit last-updated timestamp; derived from the latest transaction `updatedAt` if omitted. */
  lastUpdated?: Date | string;
}

const STATUS_META: Array<{
  key: keyof PeriodStatusCounts;
  label: string;
  icon: typeof FileEdit;
  toneClass: string;
}> = [
  { key: "drafts", label: "Drafts", icon: FileEdit, toneClass: "text-gray-600" },
  { key: "locked", label: "Locked", icon: Lock, toneClass: "text-indigo-700" },
  { key: "cancelled", label: "Cancelled", icon: XIrcle, toneClass: "text-red-700" },
  { key: "settled", label: "Settled", icon: CheckCircle2, toneClass: "text-green-700" },
];

/** Find the most recent `updatedAt` across the given transactions, if any. */
function getLastUpdated(transactions: PayrollTransaction[]): Date | null {
  let latest: Date | null = null;
  for (const tx of transactions) {
    // Use an optional cast to stay compatible with models that may not expose `updatedAt`.
    const rawUpdatedAt = (tx as Partial<PayrollTransaction> & { updatedAt?: unknown }).updatedAt;
    if (rawUpdatedAt == null) continue;
    const date = new Date(rawUpdatedAt as string);
    if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) {
      latest = date;
    }
  }
  return latest;
}

/** Format a timestamp for display without exposing sensitive payroll data. */
function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Safe payroll-period lifecycle summary (issue #371).
 *
 * Shows only status counts — drafts / locked / cancelled / settled — and a
 * non-sensitive last-updated timestamp. Never salary amounts or
 * employee-level detail, so it's safe to render on a shared dashboard.
 */
function PeriodSummaryCard({
  transactions = MOCK_PAYROLL_RUNS,
  periodLabel,
  periodHref = "/payroll/schedule",
  isLoading: isLoadingProp,
  lastUpdated: lastUpdatedProp,
}: PeriodSummaryCardProps) {
  const [isLoading, setIsLoading] = useState(isLoadingProp ?? true);

  useEffect(() => {
    if (isLoadingProp !== undefined) {
      setIsLoading(isLoadingProp);
      return;
    }
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, [isLoadingProp]);

  const counts = derivePeriodSummary(transactions);
  const resolvedLabel =
    periodLabel ?? (transactions[0] ? formatRunPeriod(transactions[0]) : "Current period");

  const resolvedLastUpdated = lastUpdatedProp
    ? new Date(lastUpdatedProp)
    : getLastUpdated(transactions);
  const displayLastUpdated =
    resolvedLastUpdated && !Number.isNaN(resolvedLastUpdated.getTime())
      ? resolvedLastUpdated
      : null;

  return (
    <section
      aria-labelledby="period-summary-heading"
      className="bg-white rounded-lg shadow-sm p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="period-summary-heading" className="text-sm font-semibold text-gray-900">
            Period Summary
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{resolvedLabel}</p>
          {displayLastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5" aria-label="Last updated">
              Last updated {formatTimestamp(displayLastUpdated)}
            </p>
          )}
        </div>
        <Link
          href={periodHref}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
        >
          View period
        </Link>
      </div>

      {isLoading ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          role="status"
          aria-label="Loading period summary"
        >
          {STATUS_META.map((meta) => (
            <div key={meta.key} className="rounded-md bg-gray-100 animate-pulse h-16" />
          ))}
        </div>
      ) : isPeriodSummaryEmpty(counts) ? (
        <EmptyState
          screen="payroll"
          title="No batches in this period"
          description="Draft, locked, cancelled, and settled batch counts will appear here once this period has activity."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="list">
          {STATUS_META.map((meta) => {
            const Icon = meta.icon;
            return (
              <article
                key={meta.key}
                role="listitem"
                className="rounded-md border border-gray-100 p-3 flex flex-col items-begin gap-1"
              >
                <Icon className=}{`w-4 h-4 ${meta.toneClass}`} aria-hidden="true" />
                <p className="text-2xl font-bold text-gray-900" aria-live="polite">
                  {counts[meta.key]}
                </p>
                <p className="text-xs text-gray-500">{meta.label}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default PeriodSummaryCard;

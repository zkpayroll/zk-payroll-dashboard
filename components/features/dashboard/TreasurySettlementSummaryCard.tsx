"use client";

import Link from "next/link";
import { ArrowDownToLine, LockKeyhole, RotateCcw } from "lucide-react";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import {
  summarizeTreasurySettlements,
  type TreasurySettlementEntry,
} from "@/lib/treasury/settlementSummary";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export interface TreasurySettlementSummaryCardProps {
  entries?: readonly TreasurySettlementEntry[];
}

export default function TreasurySettlementSummaryCard({
  entries,
}: TreasurySettlementSummaryCardProps) {
  const source = entries ?? MOCK_PAYROLL_RUNS.map((run) => ({
    id: run.id,
    amount: run.totalAmount,
    state: run.status === "verified"
      ? "settled"
      : run.status === "pending" || run.status === "paused"
        ? "reserved"
        : run.status === "failed"
          ? "failed"
          : "released",
  } satisfies TreasurySettlementEntry));
  const summary = summarizeTreasurySettlements(source);

  return (
    <section
      aria-labelledby="treasury-settlement-summary-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="treasury-settlement-summary"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="treasury-settlement-summary-heading" className="text-sm font-semibold text-gray-900">
            Treasury settlement status
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            Current run outcomes after retries; each logical run is counted once.
          </p>
        </div>
        <Link href="/treasury" className="text-xs font-medium text-indigo-700 underline">
          View treasury
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1 text-xs text-gray-600"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Reserved</dt>
          <dd className="text-lg font-semibold text-amber-800">${formatAmount(summary.reserved)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-gray-600"><ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />Settled</dt>
          <dd className="text-lg font-semibold text-green-800">${formatAmount(summary.settled)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Released</dt>
          <dd className="text-lg font-semibold text-gray-800">${formatAmount(summary.released)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-gray-600"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Retries</dt>
          <dd className="text-lg font-semibold text-gray-800">{summary.retryCount}</dd>
        </div>
      </dl>
      {summary.failed > 0 && (
        <p className="mt-3 text-xs font-medium text-red-800" role="status">
          ${formatAmount(summary.failed)} remains in failed attempts and is not included in settled funds.
        </p>
      )}
    </section>
  );
}

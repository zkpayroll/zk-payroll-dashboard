"use client";

import { useMemo, useState } from "react";
import {
  ArrowUp,
  EyeOff,
  Eye,
  Lock,
  MinusCircle,
  Pencil,
  PlusCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  applyBatchDiffFilter,
  computeBatchDiff,
  formatBatchAmount,
  shortWallet,
  summarizeBatchDiff,
  type BatchDiffEntry,
  type BatchDiffField,
  type BatchDiffFilter,
  type BatchRow,
  type BatchRowChangeType,
} from "@/lib/payroll/batchDiff";

const CHANGE_CONFIG: Record<
  BatchRowChangeType,
  { label: string; icon: LucideIcon; badgeClass: string }
> = {
  added: {
    label: "Added",
    icon: PlusCircle,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
  },
  removed: {
    label: "Removed",
    icon: MinusCircle,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  edited: {
    label: "Edited",
    icon: Pencil,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  unchanged: {
    label: "Unchanged",
    icon: ArrowUp,
    badgeClass: "bg-gray-50 text-gray-600 border-gray-200",
  },
};

const FIELD_LABELS: Record<BatchDiffField, string> = {
  walletAddress: "Wallet changed",
  assetCode: "Asset changed",
  salaryCommitment: "Commitment changed",
  salaryAmount: "Amount changed",
};

const FILTER_TABS: Array<{ key: BatchDiffFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "changed", label: "Changed" },
  { key: "unchanged", label: "Unchanged" },
  { key: "blocked", label: "Blocked" },
];

function ChangeBadge({ entry }: { entry: BatchDiffEntry }) {
  const config = CHANGE_CONFIG[entry.changeType];
  const Icon = config.icon;
  return (
    <span
      role="status"
      aria-label={`Change type: ${config.label}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function DiffValue({ before, after }: { before?: string; after?: string }) {
  if (before !== undefined && after !== undefined && before !== after) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-red-600 line-through decoration-red-300">{before}</span>
        <ArrowRight />
        <span className="text-green-700 font-medium">{after}</span>
      </span>
    );
  }
  return <span>{after ?? before ?? "—"}</span>;
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="h-3 w-3 shrink-0 text-gray-400"
    >
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 01.75-.75h9.69L10.22 6.03a.75.75 0 111.06-1.06l4.5 4.5a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 11-1.06-1.06l3.22-3.22H3.75A.75.75 0 013 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface BatchDiffViewProps {
  currentRows: BatchRow[];
  approvedRows: BatchRow[];
  title?: string;
}

/**
 * Review view comparing the current payroll draft against the previously
 * approved draft. Private salary values are redacted unless the reviewer
 * explicitly enables disclosure.
 */
export function BatchDiffView({
  currentRows,
  approvedRows,
  title = "Batch changes since last approval",
}: BatchDiffViewProps) {
  const [filter, setFilter] = useState<BatchDiffFilter>("all");
  const [allowPrivate, setAllowPrivate] = useState(false);

  const entries = useMemo(
    () => computeBatchDiff(currentRows, approvedRows),
    [currentRows, approvedRows],
  );
  const summary = useMemo(() => summarizeBatchDiff(entries), [entries]);
  const visibleEntries = useMemo(
    () => applyBatchDiffFilter(entries, filter),
    [entries, filter],
  );

  return (
    <section
      data-testid="batch-diff-view"
      aria-labelledby="batch-diff-heading"
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <header className="px-4 sm:px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 id="batch-diff-heading" className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span data-testid="diff-summary-additions">{summary.additions} added</span>
              <span data-testid="diff-summary-removals">{summary.removals} removed</span>
              <span data-testid="diff-summary-edits">{summary.edits} edited</span>
              <span data-testid="diff-summary-unchanged">{summary.unchanged} unchanged</span>
              <span data-testid="diff-summary-blocked" className={summary.blocked > 0 ? "text-red-600 font-medium" : undefined}>
                {summary.blocked} blocked
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAllowPrivate((v) => !v)}
            aria-pressed={allowPrivate}
            data-testid="toggle-private-values"
            className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              allowPrivate
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {allowPrivate ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {allowPrivate ? "Private values revealed" : "Reveal private values"}
          </button>
        </div>

        <div role="tablist" aria-label="Diff filters" className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === tab.key
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Empty batch</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Neither the current draft nor the previously approved draft contains any
            recipients.
          </p>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            No changes since last approval
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            The current draft matches the approved batch for this filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto" data-testid="diff-scroll-region">
          <table className="w-full text-left">
            <caption className="sr-only">
              Row-level diff between the current payroll draft and the previously approved draft
            </caption>
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Recipient
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Change
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Wallet
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Asset
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Commitment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleEntries.map((entry) => {
                const before = entry.before;
                const after = entry.after;
                const walletBefore = before ? shortWallet(before.walletAddress) : undefined;
                const walletAfter = after ? shortWallet(after.walletAddress) : undefined;
                const assetBefore = before?.assetCode;
                const assetAfter = after?.assetCode;
                return (
                  <tr
                    key={`${entry.employeeId}-${entry.changeType}`}
                    data-testid="diff-row"
                    data-blocked={entry.isBlocked || undefined}
                    className={entry.isBlocked ? "bg-red-50/60" : undefined}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {entry.name ?? entry.employeeId}
                          </div>
                          <div className="text-xs text-gray-500">{entry.employeeId}</div>
                        </div>
                      </div>
                      {entry.isBlocked && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Needs re-approval
                        </span>
                      )}
                      {entry.changedFields.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.changedFields.map((field) => (
                            <span
                              key={field}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
                            >
                              {FIELD_LABELS[field]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <ChangeBadge entry={entry} />
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-800">
                      <DiffValue before={walletBefore} after={walletAfter} />
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-800">
                      <DiffValue before={assetBefore} after={assetAfter} />
                    </td>
                    <td className="px-6 py-3 text-sm tabular-nums" data-testid="diff-amount-cell">
                      {!allowPrivate ? (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                          {formatBatchAmount(after?.salaryAmount ?? before?.salaryAmount, false)}
                        </span>
                      ) : entry.changeType === "edited" &&
                        entry.changedFields.includes("salaryAmount") ? (
                        <DiffValue
                          before={formatBatchAmount(before?.salaryAmount, true)}
                          after={formatBatchAmount(after?.salaryAmount, true)}
                        />
                      ) : (
                        formatBatchAmount(after?.salaryAmount ?? before?.salaryAmount, true)
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-500 truncate max-w-[12rem]">
                      <DiffValue
                        before={before?.salaryCommitment}
                        after={after?.salaryCommitment}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {summary.total > 0 && (
        <footer className="px-4 sm:px-6 py-3 border-t border-gray-100 text-xs text-gray-500">
          Showing {visibleEntries.length} of {summary.total} rows · Private salary values are
          redacted until explicitly revealed.
        </footer>
      )}
    </section>
  );
}

export default BatchDiffView;

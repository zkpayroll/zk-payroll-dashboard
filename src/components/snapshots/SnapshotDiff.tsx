"use client";

import {
  computeBatchDiff,
  formatBatchAmount,
  shortWallet,
  type BatchDiffEntry,
} from "@/lib/payroll/batchDiff";
import type { PayrollObligationSnapshot } from "@/lib/sdk/snapshots";
import { getSnapshotSafeDiff } from "@/lib/sdk/snapshots";
import {
  SNAPSHOT_MERKLE_COPY,
  SNAPSHOT_PRIVACY_NOTICE,
  formatSnapshotHash,
} from "@/lib/privacy/snapshots";
import { ArrowRight, EyeOff, Lock } from "lucide-react";

interface SnapshotDiffProps {
  snapshot: PayrollObligationSnapshot;
}

function DiffArrow() {
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />;
}

function RowDiffTable({ entries }: { entries: BatchDiffEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 px-4 sm:px-6 py-4">
        No obligation rows to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="snapshot-row-diff">
      <table className="w-full text-left">
        <caption className="sr-only">
          Privacy-safe obligation row diff between previous and current snapshots
        </caption>
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 sm:px-6 py-3 text-xs font-medium text-gray-600 uppercase">
              Recipient
            </th>
            <th scope="col" className="px-4 sm:px-6 py-3 text-xs font-medium text-gray-600 uppercase">
              Change
            </th>
            <th scope="col" className="px-4 sm:px-6 py-3 text-xs font-medium text-gray-600 uppercase">
              Wallet
            </th>
            <th scope="col" className="px-4 sm:px-6 py-3 text-xs font-medium text-gray-600 uppercase">
              Amount
            </th>
            <th scope="col" className="px-4 sm:px-6 py-3 text-xs font-medium text-gray-600 uppercase">
              Commitment
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => {
            const before = entry.before;
            const after = entry.after;
            return (
              <tr
                key={`${entry.employeeId}-${entry.changeType}`}
                data-testid="snapshot-diff-row"
                data-blocked={entry.isBlocked || undefined}
                className={entry.isBlocked ? "bg-red-50/60" : undefined}
              >
                <td className="px-4 sm:px-6 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    {entry.name ?? entry.employeeId}
                  </div>
                  {entry.isBlocked && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Needs re-approval
                    </span>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-3 text-xs capitalize text-gray-700">
                  {entry.changeType}
                </td>
                <td className="px-4 sm:px-6 py-3 font-mono text-xs text-gray-800">
                  {before && after && before.walletAddress !== after.walletAddress ? (
                    <span className="inline-flex items-center gap-1">
                      <span>{shortWallet(before.walletAddress)}</span>
                      <DiffArrow />
                      <span>{shortWallet(after.walletAddress)}</span>
                    </span>
                  ) : (
                    shortWallet(after?.walletAddress ?? before?.walletAddress ?? "—")
                  )}
                </td>
                <td className="px-4 sm:px-6 py-3 text-sm" data-testid="snapshot-diff-amount-cell">
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                    {formatBatchAmount(after?.salaryAmount ?? before?.salaryAmount, false)}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 font-mono text-xs text-gray-500 truncate max-w-[12rem]">
                  {before && after && before.salaryCommitment !== after.salaryCommitment ? (
                    <span className="inline-flex items-center gap-1">
                      <span>{formatSnapshotHash(before.salaryCommitment, 8)}</span>
                      <DiffArrow />
                      <span>{formatSnapshotHash(after.salaryCommitment, 8)}</span>
                    </span>
                  ) : (
                    formatSnapshotHash(
                      after?.salaryCommitment ?? before?.salaryCommitment ?? "",
                      8,
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SnapshotDiff({ snapshot }: SnapshotDiffProps) {
  const diff = getSnapshotSafeDiff(snapshot);
  const rowEntries = computeBatchDiff(snapshot.currentRows, snapshot.previousRows);

  return (
    <section
      data-testid="snapshot-diff"
      aria-labelledby="snapshot-diff-heading"
      className="space-y-4"
    >
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 id="snapshot-diff-heading" className="text-sm font-semibold text-gray-900">
            Snapshot metadata
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Merkle root, version, employee count, and lock status only. Salary values stay encrypted.
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {diff.fields.map((field) => (
            <div
              key={field.label}
              className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {field.label}
              </span>
              <span className="text-sm text-gray-900">
                {field.changed ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-600">{field.before}</span>
                    <DiffArrow />
                    <span className="font-medium">{field.after}</span>
                  </span>
                ) : (
                  field.after
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <Lock className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
            {SNAPSHOT_MERKLE_COPY}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Obligation row diff</h3>
          <p className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>{diff.rowSummary.additions} added</span>
            <span>{diff.rowSummary.removals} removed</span>
            <span>{diff.rowSummary.edits} edited</span>
            <span>{diff.rowSummary.unchanged} unchanged</span>
            <span className={diff.rowSummary.blocked > 0 ? "text-red-600 font-medium" : undefined}>
              {diff.rowSummary.blocked} blocked
            </span>
          </p>
        </div>
        <RowDiffTable entries={rowEntries} />
        <footer className="px-4 sm:px-6 py-3 border-t border-gray-100 bg-indigo-50/50 flex items-start gap-2 text-xs text-indigo-700">
          <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{SNAPSHOT_PRIVACY_NOTICE}</span>
        </footer>
      </div>
    </section>
  );
}

export default SnapshotDiff;

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  EyeOff,
  FileSearch,
  Lock,
} from "lucide-react";
import {
  fetchSnapshots,
  formatMerkleRoot,
  validateSnapshotLockReadiness,
} from "@/lib/sdk/snapshots";
import type { PayrollObligationSnapshot } from "@/lib/sdk/snapshots";
import { SNAPSHOT_PRIVACY_NOTICE } from "@/lib/privacy/snapshots";

type LoadState = "loading" | "loaded" | "error" | "empty";

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "locked" || normalized === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {normalized === "locked" ? "Locked" : "Approved"}
      </span>
    );
  }
  if (normalized === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Pending
      </span>
    );
  }
  if (normalized === "blocked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 text-xs font-medium">
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        Blocked
      </span>
    );
  }
  if (normalized === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-200 px-2.5 py-0.5 text-xs font-medium">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-50 text-gray-700 border border-gray-200 px-2.5 py-0.5 text-xs font-medium">
      {status}
    </span>
  );
}

function SnapshotCard({ snapshot }: { snapshot: PayrollObligationSnapshot }) {
  const validation = validateSnapshotLockReadiness(snapshot);

  return (
    <li
      data-testid={`snapshot-card-${snapshot.id}`}
      className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 ${
        validation.isBlocked ? "border-red-200 bg-red-50/20" : "border-gray-200"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/payroll/snapshots/${snapshot.id}`}
              className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              data-testid={`snapshot-link-${snapshot.id}`}
            >
              {snapshot.id}
            </Link>
            <StatusBadge status={snapshot.lockStatus} />
            {validation.isStale && (
              <span
                data-testid={`snapshot-stale-${snapshot.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs"
              >
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Stale
              </span>
            )}
            {validation.hasBlockedRows && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Blocked rows
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {snapshot.payrollId} · {snapshot.period} · v{snapshot.snapshotVersion} ·{" "}
            {snapshot.employeeCount} employees · {snapshot.assetCode}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <Link
            href={`/payroll/snapshots/${snapshot.id}`}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Review
          </Link>
          <Link
            href={`/payroll/snapshots/${snapshot.id}/approval`}
            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium ${
              validation.canApproveLock
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            aria-disabled={!validation.canApproveLock}
            data-testid={`snapshot-lock-link-${snapshot.id}`}
          >
            Approve lock
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 rounded-lg p-3 border">
        <div>
          <span className="font-medium text-gray-500">Merkle root:</span>{" "}
          <span className="font-mono text-gray-700">{formatMerkleRoot(snapshot.merkleRoot)}</span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Period:</span> {snapshot.period}
        </div>
        <div>
          <span className="font-medium text-gray-500">Employees:</span> {snapshot.employeeCount}
        </div>
      </div>

      {validation.isBlocked && validation.blockedReason && (
        <div
          role="alert"
          data-testid={`snapshot-blocked-reason-${snapshot.id}`}
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{validation.blockedReason}</span>
        </div>
      )}

      {validation.nextSteps && (
        <p className="text-xs text-gray-500">{validation.nextSteps}</p>
      )}
    </li>
  );
}

export interface SnapshotListProps {
  snapshots?: PayrollObligationSnapshot[];
  initialState?: LoadState;
}

export function SnapshotList({ snapshots: propSnapshots, initialState }: SnapshotListProps) {
  const [snapshots, setSnapshots] = useState<PayrollObligationSnapshot[] | null>(
    propSnapshots ?? null,
  );
  const [state, setState] = useState<LoadState>(
    initialState ?? (propSnapshots ? "loaded" : "loading"),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propSnapshots) {
      setSnapshots(propSnapshots);
      setState(propSnapshots.length === 0 ? "empty" : "loaded");
      return;
    }
    if (initialState) return;
    let cancelled = false;
    setState("loading");
    fetchSnapshots()
      .then((data) => {
        if (cancelled) return;
        setSnapshots(data);
        setState(data.length === 0 ? "empty" : "loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load obligation snapshots.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [propSnapshots, initialState]);

  if (state === "loading") {
    return (
      <div data-testid="snapshot-list-loading" aria-label="Loading snapshots" className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-full" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid="snapshot-list-error"
        role="alert"
        className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
      >
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load snapshots</p>
          <p className="text-sm text-red-700 mt-1">{error ?? "An unexpected error occurred."}</p>
        </div>
      </div>
    );
  }

  if (state === "empty" || (snapshots && snapshots.length === 0)) {
    return (
      <div
        data-testid="snapshot-list-empty"
        className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center"
      >
        <FileSearch className="h-10 w-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">No obligation snapshots to review</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          Payroll obligation snapshots appear here before execution lock. Salary values stay encrypted.
        </p>
        <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          {SNAPSHOT_PRIVACY_NOTICE}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="snapshot-list-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="snapshot-list-heading" className="text-sm font-semibold text-gray-900">
          Obligation snapshots ({snapshots?.length ?? 0})
        </h2>
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          Salary values encrypted
        </span>
      </div>

      <ul className="space-y-3" data-testid="snapshot-list">
        {snapshots?.map((snapshot) => (
          <SnapshotCard key={snapshot.id} snapshot={snapshot} />
        ))}
      </ul>

      <footer className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-2 text-xs text-indigo-700">
        <EyeOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{SNAPSHOT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default SnapshotList;

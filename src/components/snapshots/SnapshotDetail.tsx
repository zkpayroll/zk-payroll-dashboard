"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  EyeOff,
  FileSearch,
  Lock,
  Clock,
} from "lucide-react";
import { fetchSnapshotById, validateSnapshotLockReadiness } from "@/lib/sdk/snapshots";
import type { PayrollObligationSnapshot } from "@/lib/sdk/snapshots";
import SnapshotDiff from "./SnapshotDiff";
import { SNAPSHOT_PRIVACY_NOTICE } from "@/lib/privacy/snapshots";

type LoadState = "loading" | "loaded" | "error" | "empty" | "blocked" | "locked" | "failed";

export interface SnapshotDetailProps {
  snapshotId: string;
  snapshot?: PayrollObligationSnapshot | null;
  initialState?: LoadState;
}

export function SnapshotDetail({
  snapshotId,
  snapshot: propSnapshot,
  initialState,
}: SnapshotDetailProps) {
  const [snapshot, setSnapshot] = useState<PayrollObligationSnapshot | null | undefined>(
    propSnapshot !== undefined ? propSnapshot : undefined,
  );
  const [state, setState] = useState<LoadState>(
    initialState ??
      (propSnapshot !== undefined ? (propSnapshot ? "loaded" : "empty") : "loading"),
  );

  useEffect(() => {
    if (propSnapshot !== undefined) {
      setSnapshot(propSnapshot);
      if (initialState) return;
      if (propSnapshot === null) setState("empty");
      else if (propSnapshot) {
        const v = validateSnapshotLockReadiness(propSnapshot);
        if (propSnapshot.lockStatus === "locked") setState("locked");
        else if (propSnapshot.lockStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      }
      return;
    }
    if (initialState) return;
    let cancelled = false;
    setState("loading");
    fetchSnapshotById(snapshotId)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        if (!data) {
          setState("empty");
          return;
        }
        const v = validateSnapshotLockReadiness(data);
        if (data.lockStatus === "locked") setState("locked");
        else if (data.lockStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId, propSnapshot, initialState]);

  if (state === "loading") {
    return (
      <div data-testid="snapshot-detail-loading" className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-40" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div data-testid="snapshot-detail-error" role="alert" className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-sm font-medium text-red-800">Failed to load snapshot</p>
      </div>
    );
  }

  if (state === "empty" || !snapshot) {
    return (
      <div data-testid="snapshot-detail-empty" className="bg-white rounded-xl border border-dashed p-12 text-center">
        <FileSearch className="h-10 w-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Snapshot not found</h3>
        <Link href="/payroll/snapshots" className="mt-4 inline-flex px-4 py-2 rounded-md bg-indigo-600 text-white text-sm">
          Back to snapshots
        </Link>
      </div>
    );
  }

  const validation = validateSnapshotLockReadiness(snapshot);

  return (
    <section aria-labelledby="snapshot-detail-heading" className="space-y-6">
      <Link href="/payroll/snapshots" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to snapshots
      </Link>

      <header className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 id="snapshot-detail-heading" className="text-lg font-semibold text-gray-900">
              Snapshot {snapshot.id}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {snapshot.payrollId} · {snapshot.period} · v{snapshot.snapshotVersion} ·{" "}
              {snapshot.employeeCount} employees
            </p>
          </div>
          <span
            data-testid="snapshot-status-badge"
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium bg-gray-50 text-gray-700 border-gray-200"
          >
            {snapshot.lockStatus === "locked" ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : snapshot.lockStatus === "pending" ? (
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {snapshot.lockStatus}
          </span>
        </div>

        {snapshot.reason && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</p>
            <p className="text-sm text-gray-700 mt-1">{snapshot.reason}</p>
          </div>
        )}

        {validation.isBlocked && validation.blockedReason && (
          <div data-testid="snapshot-blocked" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {validation.blockedReason}
          </div>
        )}

        {validation.nextSteps && !validation.isBlocked && (
          <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{validation.nextSteps}</span>
          </div>
        )}
      </header>

      <SnapshotDiff snapshot={snapshot} />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/payroll/snapshots/${snapshot.id}/approval`}
          data-testid="snapshot-lock-cta"
          className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium ${
            validation.canApproveLock
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          aria-disabled={!validation.canApproveLock}
        >
          {validation.canApproveLock ? "Review lock readiness" : "Lock unavailable"}
        </Link>
      </div>

      <footer className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{SNAPSHOT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default SnapshotDetail;

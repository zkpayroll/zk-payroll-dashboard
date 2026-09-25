"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Lock,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { fetchSnapshotById, validateSnapshotLockReadiness } from "@/lib/sdk/snapshots";
import type { PayrollObligationSnapshot } from "@/lib/sdk/snapshots";
import SnapshotDiff from "./SnapshotDiff";
import { SNAPSHOT_PRIVACY_NOTICE } from "@/lib/privacy/snapshots";

type LoadState =
  | "loading"
  | "loaded"
  | "error"
  | "empty"
  | "locking"
  | "locked"
  | "failed"
  | "blocked";

export interface SnapshotLockApprovalProps {
  snapshotId: string;
  snapshot?: PayrollObligationSnapshot | null;
  initialState?: LoadState;
}

export function SnapshotLockApproval({
  snapshotId,
  snapshot: propSnapshot,
  initialState,
}: SnapshotLockApprovalProps) {
  const [snapshot, setSnapshot] = useState<PayrollObligationSnapshot | null | undefined>(
    propSnapshot !== undefined ? propSnapshot : undefined,
  );
  const [state, setState] = useState<LoadState>(
    initialState ??
      (propSnapshot !== undefined
        ? propSnapshot
          ? propSnapshot.lockStatus === "locked"
            ? "locked"
            : propSnapshot.lockStatus === "failed"
              ? "failed"
              : validateSnapshotLockReadiness(propSnapshot).isBlocked
                ? "blocked"
                : "loaded"
          : "empty"
        : "loading"),
  );
  const [lockError, setLockError] = useState<string | null>(null);

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

  const handleApproveLock = async () => {
    if (!snapshot) return;
    const validation = validateSnapshotLockReadiness(snapshot);
    if (!validation.canApproveLock) return;
    setState("locking");
    setLockError(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (validation.canApproveLock) {
      setState("locked");
    } else {
      setLockError("Lock approval blocked by SDK validation.");
      setState("blocked");
    }
  };

  if (state === "loading" || state === "locking") {
    return (
      <div
        data-testid={state === "locking" ? "snapshot-locking" : "snapshot-approval-loading"}
        className="space-y-4 animate-pulse"
      >
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-40" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div data-testid="snapshot-approval-error" role="alert" className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-sm font-medium text-red-800">Failed to load snapshot approval</p>
      </div>
    );
  }

  if (state === "empty" || !snapshot) {
    return (
      <div data-testid="snapshot-approval-empty" className="bg-white rounded-xl border border-dashed p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Snapshot not found</h3>
        <Link href="/payroll/snapshots" className="mt-4 inline-flex px-4 py-2 rounded-md bg-indigo-600 text-white text-sm">
          Back to snapshots
        </Link>
      </div>
    );
  }

  const validation = validateSnapshotLockReadiness(snapshot);

  if (state === "locked") {
    return (
      <section data-testid="snapshot-locked-state" className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-green-900">Obligation snapshot locked</h2>
            <p className="text-sm text-green-700 mt-1">
              {validation.nextSteps ?? "Execution may proceed with this frozen obligation set."}
            </p>
          </div>
        </div>
        <SnapshotDiff snapshot={{ ...snapshot, lockStatus: "locked" }} />
      </section>
    );
  }

  if (state === "blocked" || validation.isBlocked) {
    return (
      <section data-testid="snapshot-blocked-state" className="space-y-6">
        <div data-testid="snapshot-blocked" role="alert" className="bg-red-50 border border-red-200 rounded-xl p-6">
          <ShieldAlert className="h-6 w-6 text-red-600 mb-2" aria-hidden="true" />
          <h2 className="text-base font-semibold text-red-900">Lock approval blocked</h2>
          <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
          {validation.nextSteps && <p className="text-sm text-red-600 mt-2">{validation.nextSteps}</p>}
        </div>
        <SnapshotDiff snapshot={snapshot} />
        <button
          type="button"
          disabled
          data-testid="snapshot-lock-disabled"
          className="inline-flex items-center px-4 py-2 rounded-md bg-gray-100 text-gray-400 text-sm cursor-not-allowed"
        >
          <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Lock blocked
        </button>
      </section>
    );
  }

  return (
    <section data-testid="snapshot-lock-approval" className="space-y-6">
      <Link href={`/payroll/snapshots/${snapshot.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to detail
      </Link>

      <header className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-gray-900">Approve lock for {snapshot.id}</h1>
        </div>
        <p className="text-sm text-gray-600">
          Confirm obligation metadata and diffs match the payroll you intend to execute. Salary values stay encrypted.
        </p>
      </header>

      <SnapshotDiff snapshot={snapshot} />

      {lockError && (
        <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {lockError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <button
          type="button"
          onClick={handleApproveLock}
          disabled={!validation.canApproveLock}
          data-testid="snapshot-lock-button"
          className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium ${
            validation.canApproveLock
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {validation.canApproveLock ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Confirm lock readiness
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Lock blocked
            </>
          )}
        </button>
        {!validation.canApproveLock && validation.blockedReason && (
          <p data-testid="snapshot-lock-blocked-reason" className="text-xs text-red-600">
            {validation.blockedReason}
          </p>
        )}
      </div>

      <footer className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{SNAPSHOT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default SnapshotLockApproval;

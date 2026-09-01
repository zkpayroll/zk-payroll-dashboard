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
import { fetchAmendments, validateAmendmentPlan } from "@/lib/sdk/amendments";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import { AMENDMENT_PRIVACY_NOTICE, formatCommitmentShort } from "@/lib/privacy/amendments";
import { formatAsset } from "@/lib/sdk/amendments";

type LoadState = "loading" | "loaded" | "error" | "empty";

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 text-xs font-medium">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Approved
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

function AmendmentCard({ amendment }: { amendment: SalaryCommitmentAmendment }) {
  const validation = validateAmendmentPlan(amendment);
  const isBlocked = validation.isBlocked;

  return (
    <li
      data-testid={`amendment-card-${amendment.id}`}
      className={`bg-white rounded-xl border shadow-sm p-5 space-y-3 ${
        isBlocked ? "border-red-200 bg-red-50/20" : "border-gray-200"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/payroll/amendments/${amendment.id}`}
              className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              data-testid={`amendment-link-${amendment.id}`}
            >
              {amendment.id}
            </Link>
            <StatusBadge status={amendment.approvalStatus} />
            {validation.isStale && (
              <span
                data-testid={`amendment-stale-${amendment.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs"
              >
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Stale
              </span>
            )}
            {!validation.isPolicyValid && (
              <span
                data-testid={`amendment-policy-invalid-${amendment.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                Policy invalid
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {amendment.employeeReference} · {amendment.period} · {formatAsset(amendment.asset)} · v
            {amendment.previousVersion} → v{amendment.commitmentVersion}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Review
          </Link>
          <Link
            href={`/payroll/amendments/${amendment.id}/approval`}
            className={`inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium ${
              validation.canApprove
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            aria-disabled={!validation.canApprove}
            data-testid={`amendment-approve-link-${amendment.id}`}
          >
            Approve
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 rounded-lg p-3 border">
        <div>
          <span className="font-medium text-gray-500">Commitment:</span>{" "}
          <span className="font-mono text-gray-700">{formatCommitmentShort(amendment.nextCommitment)}</span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Period:</span> {amendment.period}
        </div>
        <div>
          <span className="font-medium text-gray-500">Asset:</span> {formatAsset(amendment.asset)}
        </div>
      </div>

      {isBlocked && validation.blockedReason && (
        <div
          role="alert"
          data-testid={`amendment-blocked-reason-${amendment.id}`}
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

export interface AmendmentListProps {
  amendments?: SalaryCommitmentAmendment[];
  /** Force a load state for testing/storybook */
  initialState?: LoadState;
}

export function AmendmentList({ amendments: propAmendments, initialState }: AmendmentListProps) {
  const [amendments, setAmendments] = useState<SalaryCommitmentAmendment[] | null>(
    propAmendments ?? null,
  );
  const [state, setState] = useState<LoadState>(initialState ?? (propAmendments ? "loaded" : "loading"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propAmendments) {
      setAmendments(propAmendments);
      setState(propAmendments.length === 0 ? "empty" : "loaded");
      return;
    }
    if (initialState) return;
    let cancelled = false;
    setState("loading");
    fetchAmendments()
      .then((data) => {
        if (cancelled) return;
        setAmendments(data);
        setState(data.length === 0 ? "empty" : "loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load amendments.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [propAmendments, initialState]);

  if (state === "loading") {
    return (
      <div data-testid="amendment-list-loading" aria-label="Loading amendments" className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-100 rounded w-64" />
          </div>
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid="amendment-list-error"
        role="alert"
        className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
      >
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load amendments</p>
          <p className="text-sm text-red-700 mt-1">{error ?? "An unexpected error occurred."}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state === "empty" || (amendments && amendments.length === 0)) {
    return (
      <div
        data-testid="amendment-list-empty"
        className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center"
      >
        <FileSearch className="h-10 w-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">No amendments to review</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          Encrypted salary commitment amendments will appear here when a compensation change is proposed.
          Salary values stay encrypted at all times.
        </p>
        <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          {AMENDMENT_PRIVACY_NOTICE}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="amendment-list-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="amendment-list-heading" className="text-sm font-semibold text-gray-900">
          Amendments ({amendments?.length ?? 0})
        </h2>
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          Salary values encrypted
        </span>
      </div>

      <ul className="space-y-3" data-testid="amendment-list">
        {amendments?.map((a) => (
          <AmendmentCard key={a.id} amendment={a} />
        ))}
      </ul>

      <footer className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-2 text-xs text-indigo-700">
        <EyeOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{AMENDMENT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default AmendmentList;

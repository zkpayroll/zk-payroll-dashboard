"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  EyeOff,
  FileSearch,
  Lock,
} from "lucide-react";
import { fetchAmendmentById, validateAmendmentPlan } from "@/lib/sdk/amendments";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import AmendmentDiff from "./AmendmentDiff";
import { AMENDMENT_PRIVACY_NOTICE } from "@/lib/privacy/amendments";

type LoadState = "loading" | "loaded" | "error" | "empty" | "blocked" | "approved" | "failed";

export interface AmendmentDetailProps {
  amendmentId: string;
  amendment?: SalaryCommitmentAmendment | null;
  /** Force state for tests */
  initialState?: LoadState;
}

function StateBanner({
  amendment,
  validation,
}: {
  amendment: SalaryCommitmentAmendment;
  validation: ReturnType<typeof validateAmendmentPlan>;
}) {
  if (amendment.approvalStatus === "approved") {
    return (
      <div
        data-testid="amendment-approved"
        role="status"
        className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4"
      >
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-green-800">Amendment approved</p>
          <p className="text-sm text-green-700 mt-1">{validation.nextSteps}</p>
        </div>
      </div>
    );
  }
  if (validation.isBlocked) {
    return (
      <div
        data-testid="amendment-blocked"
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">
            {validation.isStale ? "Stale commitment — approval blocked" : "Approval blocked"}
          </p>
          <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
          {validation.nextSteps && (
            <p className="text-xs text-red-600 mt-2">{validation.nextSteps}</p>
          )}
        </div>
      </div>
    );
  }
  if (amendment.approvalStatus === "failed") {
    return (
      <div
        data-testid="amendment-failed"
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Amendment failed</p>
          <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
          {validation.nextSteps && (
            <p className="text-xs text-red-600 mt-2">{validation.nextSteps}</p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function AmendmentDetail({
  amendmentId,
  amendment: propAmendment,
  initialState,
}: AmendmentDetailProps) {
  const [amendment, setAmendment] = useState<SalaryCommitmentAmendment | null | undefined>(
    propAmendment !== undefined ? propAmendment : undefined,
  );
  const [state, setState] = useState<LoadState>(
    initialState ?? (propAmendment !== undefined ? (propAmendment ? "loaded" : "empty") : "loading"),
  );

  useEffect(() => {
    if (propAmendment !== undefined) {
      setAmendment(propAmendment);
      if (initialState) return;
      if (propAmendment === null) setState("empty");
      else if (propAmendment) {
        const v = validateAmendmentPlan(propAmendment);
        if (propAmendment.approvalStatus === "approved") setState("approved");
        else if (propAmendment.approvalStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      }
      return;
    }
    if (initialState) return;
    let cancelled = false;
    setState("loading");
    fetchAmendmentById(amendmentId)
      .then((data) => {
        if (cancelled) return;
        setAmendment(data);
        if (!data) {
          setState("empty");
          return;
        }
        const v = validateAmendmentPlan(data);
        if (data.approvalStatus === "approved") setState("approved");
        else if (data.approvalStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [amendmentId, propAmendment, initialState]);

  if (state === "loading") {
    return (
      <div data-testid="amendment-detail-loading" aria-label="Loading amendment details" className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-20 bg-gray-100 rounded" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div data-testid="amendment-detail-error" role="alert" className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load amendment</p>
          <p className="text-sm text-red-700 mt-1">Could not fetch amendment {amendmentId}. Try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state === "empty" || !amendment) {
    return (
      <div data-testid="amendment-detail-empty" className="bg-white rounded-xl border border-dashed p-12 text-center">
        <FileSearch className="h-10 w-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Amendment not found</h3>
        <p className="text-sm text-gray-500 mt-1">
          No amendment with ID {amendmentId} exists. It may have been removed or the link is stale.
        </p>
        <Link
          href="/payroll/amendments"
          className="mt-4 inline-flex px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          Back to amendments
        </Link>
      </div>
    );
  }

  const validation = validateAmendmentPlan(amendment);

  return (
    <section aria-labelledby="amendment-detail-heading" className="space-y-6">
      <Link
        href="/payroll/amendments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to amendments
      </Link>

      <header className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 id="amendment-detail-heading" className="text-lg font-semibold text-gray-900">
              Amendment {amendment.id}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {amendment.employeeReference} · {amendment.period} · v{amendment.previousVersion} → v{amendment.commitmentVersion}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Requested by {amendment.requestedBy} · {new Date(amendment.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="amendment-status-badge"
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${
                amendment.approvalStatus === "approved"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : amendment.approvalStatus === "pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {amendment.approvalStatus === "approved" ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : amendment.approvalStatus === "pending" ? (
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              ) : amendment.approvalStatus === "failed" ? (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {amendment.approvalStatus}
            </span>
          </div>
        </div>

        {amendment.reason && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</p>
            <p className="text-sm text-gray-700 mt-1">{amendment.reason}</p>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Privacy-safe — no salary values exposed.
            </p>
          </div>
        )}

        <StateBanner amendment={amendment} validation={validation} />

        {validation.nextSteps && !validation.isBlocked && (
          <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            <Lock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{validation.nextSteps}</span>
          </div>
        )}
      </header>

      <AmendmentDiff amendment={amendment} />

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/payroll/amendments/${amendment.id}/approval`}
          data-testid="amendment-approval-cta"
          className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            validation.canApprove
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          aria-disabled={!validation.canApprove}
        >
          {validation.canApprove ? "Review & approve" : "Approval unavailable"}
        </Link>
        <Link
          href="/payroll/amendments"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to list
        </Link>
      </div>

      <footer className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{AMENDMENT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default AmendmentDetail;

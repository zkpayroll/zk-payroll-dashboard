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
import {
  fetchAmendmentById,
  validateAmendmentPlan,
} from "@/lib/sdk/amendments";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import AmendmentDiff from "./AmendmentDiff";
import { AMENDMENT_PRIVACY_NOTICE } from "@/lib/privacy/amendments";

type LoadState = "loading" | "loaded" | "error" | "empty" | "approving" | "approved" | "failed" | "blocked";

export interface AmendmentApprovalProps {
  amendmentId: string;
  amendment?: SalaryCommitmentAmendment | null;
  initialState?: LoadState;
}

export function AmendmentApproval({
  amendmentId,
  amendment: propAmendment,
  initialState,
}: AmendmentApprovalProps) {
  const [amendment, setAmendment] = useState<SalaryCommitmentAmendment | null | undefined>(
    propAmendment !== undefined ? propAmendment : undefined,
  );
  const [state, setState] = useState<LoadState>(
    initialState ??
      (propAmendment !== undefined
        ? propAmendment
          ? propAmendment.approvalStatus === "approved"
            ? "approved"
            : propAmendment.approvalStatus === "failed"
              ? "failed"
              : validateAmendmentPlan(propAmendment).isBlocked
                ? "blocked"
                : "loaded"
          : "empty"
        : "loading"),
  );
  const [approvalError, setApprovalError] = useState<string | null>(null);

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

  const handleApprove = async () => {
    if (!amendment) return;
    const validation = validateAmendmentPlan(amendment);
    if (!validation.canApprove) return;
    setState("approving");
    setApprovalError(null);
    // Simulate SDK approval call with validation gate
    await new Promise((resolve) => setTimeout(resolve, 600));
    // Mock: approve succeeds for valid pending amendments
    if (validation.canApprove) {
      setState("approved");
    } else {
      setApprovalError("Approval blocked by SDK validation.");
      setState("blocked");
    }
  };

  if (state === "loading" || state === "approving") {
    return (
      <div
        data-testid={state === "approving" ? "amendment-approving" : "amendment-approval-loading"}
        aria-label={state === "approving" ? "Approving amendment" : "Loading approval screen"}
        className="space-y-4"
      >
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded w-40" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid="amendment-approval-error"
        role="alert"
        className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
      >
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load amendment</p>
          <p className="text-sm text-red-700 mt-1">Could not fetch amendment {amendmentId}.</p>
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
      <div data-testid="amendment-approval-empty" className="bg-white rounded-xl border border-dashed p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Amendment not found</h3>
        <p className="text-sm text-gray-500 mt-1">The requested amendment does not exist.</p>
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

  // Approved state
  if (state === "approved") {
    return (
      <section data-testid="amendment-approved-state" aria-labelledby="approval-heading" className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="approval-heading" className="text-base font-semibold text-green-900">
              Amendment approved
            </h2>
            <p className="text-sm text-green-700 mt-1">
              {validation.nextSteps ?? "New commitment is active. Salary values remain encrypted."}
            </p>
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1.5">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Privacy preserved — raw salary never exposed.
            </p>
          </div>
        </div>

        <AmendmentDiff amendment={{ ...amendment, approvalStatus: "approved" }} />

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View amendment
          </Link>
          <Link
            href="/payroll/amendments"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Back to list
          </Link>
        </div>
      </section>
    );
  }

  // Failed state
  if (state === "failed") {
    return (
      <section data-testid="amendment-failed-state" role="alert" className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-red-900">Amendment failed</h2>
            <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
            <p className="text-xs text-red-600 mt-2">{validation.nextSteps}</p>
          </div>
        </div>

        <AmendmentDiff amendment={amendment} />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setState("loaded")}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            data-testid="amendment-retry-button"
          >
            Retry review
          </button>
          <Link
            href="/payroll/amendments"
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
          >
            Back to list
          </Link>
        </div>
      </section>
    );
  }

  // Blocked state (stale or policy-invalid)
  if (state === "blocked" || validation.isBlocked) {
    return (
      <section
        data-testid="amendment-blocked-state"
        aria-labelledby="blocked-heading"
        className="space-y-6"
      >
        <Link
          href={`/payroll/amendments/${amendment.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to detail
        </Link>

        <div
          data-testid="amendment-blocked"
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
        >
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="blocked-heading" className="text-base font-semibold text-red-900">
              {validation.isStale
                ? "Stale commitment — approval blocked"
                : !validation.isPolicyValid
                  ? "Policy violation — approval blocked"
                  : "Approval blocked"}
            </h2>
            <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
            {validation.nextSteps && (
              <p className="text-sm text-red-600 mt-2">{validation.nextSteps}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-red-600">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SDK validation prevents approval of stale or policy-invalid plans.</span>
            </div>
          </div>
        </div>

        <AmendmentDiff amendment={amendment} />

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-800">Required next steps</h3>
          <p className="text-sm text-amber-700 mt-1">{validation.nextSteps}</p>
          <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-1">
            {validation.isStale && <li>Request a fresh amendment with the latest commitment version.</li>}
            {!validation.isPolicyValid && <li>Correct the amendment to meet asset, period, or threshold policy.</li>}
            <li>Salary values stay encrypted — only hashes and safe metadata are reviewed.</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-testid="amendment-approve-disabled"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
          >
            <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Approval blocked
          </button>
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to detail
          </Link>
        </div>

        <footer className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{AMENDMENT_PRIVACY_NOTICE}</span>
        </footer>
      </section>
    );
  }

  // Loaded — pending valid state
  return (
    <section
      data-testid="amendment-approval"
      aria-labelledby="approval-heading"
      className="space-y-6"
    >
      <Link
        href={`/payroll/amendments/${amendment.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to detail
      </Link>

      <header className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <h1 id="approval-heading" className="text-lg font-semibold text-gray-900">
            Approve amendment {amendment.id}
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Review safe metadata below. Salary values remain encrypted — only commitment hashes,
          employee reference, period, asset, and approval status are shown.
        </p>
        {validation.nextSteps && (
          <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            {validation.nextSteps}
          </p>
        )}
      </header>

      <AmendmentDiff amendment={amendment} />

      {approvalError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          {approvalError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Approval decision</h3>
        <p className="text-xs text-gray-500">
          Approving applies the new commitment hash on-chain. This action is audited and cannot be
          undone without a new amendment.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!validation.canApprove}
            data-testid="amendment-approve-button"
            aria-disabled={!validation.canApprove}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              validation.canApprove
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {validation.canApprove ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Confirm approval
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Approval blocked
              </>
            )}
          </button>
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>

        {!validation.canApprove && validation.blockedReason && (
          <p
            data-testid="amendment-approval-blocked-reason"
            className="text-xs text-red-600 flex items-start gap-1.5"
          >
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            {validation.blockedReason}
          </p>
        )}
      </div>

      <footer className="flex items-start gap-2 text-xs text-gray-500 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{AMENDMENT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}

export default AmendmentApproval;

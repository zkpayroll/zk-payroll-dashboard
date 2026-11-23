"use client";

import Link from "next/link";
import { AlertTriangle, ShieldAlert, RefreshCw } from "lucide-react";

export interface MissingProofWarningProps {
  /** Optional run id for contextual messaging — never include salary data. */
  runId?: string;
  /** Where the "Generate proof" CTA should lead. */
  actionHref?: string;
  actionLabel?: string;
  /** Compact inline variant */
  compact?: boolean;
  className?: string;
}

/**
 * Warning shown when a payroll action is blocked because proof data is missing.
 * Tells the operator exactly what to add before trying again.
 * Privacy-safe: mentions only proof requirement, never salary amounts or commitments.
 */
export function MissingProofWarning({
  runId,
  actionHref = "/payroll/execute",
  actionLabel = "Generate proof",
  compact = false,
  className = "",
}: MissingProofWarningProps) {
  if (compact) {
    return (
      <div
        role="alert"
        data-testid="missing-proof-warning"
        aria-label="Payroll action blocked — proof missing"
        className={`inline-flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Proof required — add proof data before retrying.</span>
        <Link href={actionHref} className="font-medium underline underline-offset-2 hover:no-underline">
          {actionLabel}
        </Link>
      </div>
    );
  }

  return (
    <div
      role="alert"
      data-testid="missing-proof-warning"
      aria-label="Payroll action blocked — proof missing"
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 ${className}`}
    >
      <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Proof required — action blocked</p>
        <p className="text-sm text-amber-700 mt-1">
          This payroll action is blocked because no ZK proof data is attached
          {runId ? ` to run ${runId}` : ""}. Generate a fresh payroll proof before trying again.
          No salary values are shown or logged here.
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Expected: a valid proof reference (<span className="font-mono">zkp_ref_YYYYMMDD_NNN</span>) and a verified proof status. If you just created the batch, run proof generation first.
        </p>
        <Link
          href={actionHref}
          data-testid="missing-proof-action"
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Variant for expired proofs — reuses the same CTA pattern but with expired copy.
 * Kept here so callers can import a single warning family for any proof blocker.
 */
export function ExpiredProofWarning({
  actionHref = "/payroll/execute",
  actionLabel = "Replace proof",
  className = "",
}: {
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-testid="expired-proof-warning"
      aria-label="Payroll action blocked — proof expired"
      className={`rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">Proof expired — action blocked</p>
        <p className="text-sm text-red-700 mt-1">
          The attached proof has expired. Execution will fail until a fresh proof replaces it. Generate a new proof before retrying.
        </p>
        <Link
          href={actionHref}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

export default MissingProofWarning;

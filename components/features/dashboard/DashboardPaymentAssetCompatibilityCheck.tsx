"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Coins, ShieldAlert } from "lucide-react";
import { evaluatePaymentAssetCompatibility } from "@/lib/assets/paymentAssetCompatibility";
import { getSupportedAsset } from "@/lib/assets/supportedAssets";
import type { PaymentAssetTarget } from "@/types/assets";

export interface DashboardPaymentAssetCompatibilityCheckProps {
  /**
   * Intended payments (which asset each employee should be paid in). When the
   * prop is omitted the panel falls back to a healthy demo set so the dashboard
   * always renders a meaningful state; pass `[]` to exercise the "nothing
   * assigned" state.
   */
  paymentTargets?: PaymentAssetTarget[] | null;
  /** Invoked when the remediation link is activated, for in-page flows. */
  onReviewClick?: () => void;
  className?: string;
}

/**
 * Demo targets used when no `paymentTargets` prop is supplied. Deliberately
 * healthy and mixing native XLM with issued USDC (one target relying on the
 * canonical issuer default, one stating it explicitly) so the panel exercises
 * the compatible path. Contains no real employee identities.
 */
function buildDemoTargets(): PaymentAssetTarget[] {
  return [
    { employeeId: "demo-1", assetCode: "USDC" },
    {
      employeeId: "demo-2",
      assetCode: "USDC",
      assetIssuer: getSupportedAsset("USDC")?.issuer,
    },
    { employeeId: "demo-3", assetCode: "xlm" },
  ];
}

function toneClass(status: "compatible" | "warning" | "incompatible"): string {
  if (status === "compatible") return "border-green-200 bg-green-50";
  return "border-amber-200 bg-amber-50";
}

function StatusIcon({ status }: { status: "compatible" | "warning" | "incompatible" }) {
  if (status === "incompatible") {
    return (
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
        aria-hidden="true"
      />
    );
  }
  if (status === "warning") {
    return (
      <ShieldAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
        aria-hidden="true"
      />
    );
  }
  return (
    <CheckCircle2
      className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
      aria-hidden="true"
    />
  );
}

/**
 * A privacy-safe dashboard check that validates the Stellar assets intended to
 * pay employees are compatible before a payroll run is executed: every asset is
 * supported, issued assets use the supported issuer, and the same code is never
 * split across conflicting issuers.
 *
 * The panel only ever receives and renders asset codes, issuer accounts, opaque
 * counts, and messages — never employee identities, wallet addresses, or
 * payment amounts — so it is safe to surface directly on the operations
 * dashboard.
 */
export default function DashboardPaymentAssetCompatibilityCheck({
  paymentTargets,
  onReviewClick,
  className = "",
}: DashboardPaymentAssetCompatibilityCheckProps) {
  const resolvedTargets =
    paymentTargets === undefined ? buildDemoTargets() : (paymentTargets ?? []);

  const result = evaluatePaymentAssetCompatibility(resolvedTargets);
  const isCompatible = result.status === "compatible";
  const isWarning = result.status === "warning";
  const tone = toneClass(result.status);

  const badge = isCompatible
    ? { label: "Ready", className: "bg-green-100 text-green-800" }
    : isWarning
      ? { label: "Notice", className: "bg-amber-100 text-amber-800" }
      : { label: "Action Required", className: "bg-amber-100 text-amber-800" };

  return (
    <section
      role="status"
      aria-labelledby="dashboard-payment-asset-compatibility-heading"
      className={`rounded-lg border p-4 transition-all ${tone} ${className}`}
      data-testid="dashboard-payment-asset-compatibility"
      data-status={result.status}
      data-can-run-payroll={result.canRunPayroll ? "true" : "false"}
      data-compatible-count={result.compatibleAssets.length}
      data-error-count={result.blockers.length}
      data-warning-count={result.warnings.length}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={result.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-payment-asset-compatibility-heading"
              className="text-sm font-semibold text-gray-900"
            >
              <Coins
                className="mr-1.5 inline h-4 w-4 align-text-bottom"
                aria-hidden="true"
              />
              Payment asset compatibility
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <p
            className={`mt-1 text-sm ${isCompatible ? "text-green-800" : "text-amber-800"}`}
            data-testid="dashboard-payment-asset-compatibility-summary"
          >
            {result.summaryMessage}
          </p>

          {result.blockers.length > 0 && (
            <ul
              className="mt-2 space-y-1 text-xs text-amber-800"
              data-testid="dashboard-payment-asset-compatibility-blockers"
            >
              {result.blockers.map((blocker, index) => (
                <li key={index}>• {blocker}</li>
              ))}
            </ul>
          )}

          {result.warnings.length > 0 && (
            <ul
              className="mt-2 space-y-1 text-xs text-amber-700"
              data-testid="dashboard-payment-asset-compatibility-warnings"
            >
              {result.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          )}

          {result.compatibleAssets.length > 0 && (
            <ul
              className="mt-3 flex flex-wrap gap-2"
              data-testid="dashboard-payment-asset-compatibility-assets"
            >
              {result.compatibleAssets.map((asset) => (
                <li
                  key={asset.code}
                  data-testid={`dashboard-payment-asset-compatibility-asset-${asset.code}`}
                  className="rounded-full border border-gray-200 bg-white/70 px-2.5 py-0.5 text-xs text-gray-700"
                >
                  <span className="font-medium text-gray-900">{asset.code}</span>
                  {" · "}
                  {asset.paymentCount}{" "}
                  {asset.paymentCount === 1 ? "payment" : "payments"}
                </li>
              ))}
            </ul>
          )}

          {result.remediationAction && (
            <div className="mt-3 flex items-center gap-3">
              <Link
                href={result.remediationAction.href}
                onClick={(event) => {
                  if (onReviewClick) {
                    event.preventDefault();
                    onReviewClick();
                  }
                }}
                className="inline-flex rounded text-sm font-medium text-amber-900 underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
              >
                {result.remediationAction.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

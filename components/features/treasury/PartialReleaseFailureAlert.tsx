"use client";

import { AlertTriangle } from "lucide-react";
import { summarizePartialRelease, type PartialReleaseFailure } from "@/lib/treasury/partialRelease";

/**
 * Explains a partially failed treasury release and what to do next (#760).
 * Counts and reason codes only — no recipients, addresses or amounts.
 */
export function PartialReleaseFailureAlert({ failure }: { failure: PartialReleaseFailure }) {
  const summary = summarizePartialRelease(failure);
  if (summary.failed === 0) return null;

  const unaccounted = summary.failed - summary.steps.reduce((sum, s) => sum + s.count, 0);

  return (
    <div
      role="alert"
      data-testid="partial-release-failure"
      data-partial={summary.isPartial}
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800">
          {summary.isPartial ? "Treasury release partially failed" : "Treasury release failed"}
        </p>
        <p className="mt-1 text-sm text-red-700" data-testid="partial-release-counts">
          {summary.released} of {summary.requested} released, {summary.failed} failed.
          {summary.isPartial && " Released items are final and do not need to be repeated."}
        </p>
        <ul className="mt-3 space-y-2">
          {summary.steps.map((step) => (
            <li key={step.reason} className="text-xs text-red-800" data-testid={`release-failure-${step.reason}`}>
              <span className="font-medium">
                {step.label} ({step.count})
              </span>
              <span className="block text-red-700">{step.nextStep}</span>
            </li>
          ))}
          {unaccounted > 0 && (
            <li className="text-xs text-red-800" data-testid="release-failure-unaccounted">
              <span className="font-medium">No reason reported ({unaccounted})</span>
              <span className="block text-red-700">
                Check the incident log for release {summary.releaseId} before retrying.
              </span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-xs text-red-600">
          Release {summary.releaseId}. Recipients, addresses and amounts are not shown here.
        </p>
      </div>
    </div>
  );
}

export default PartialReleaseFailureAlert;

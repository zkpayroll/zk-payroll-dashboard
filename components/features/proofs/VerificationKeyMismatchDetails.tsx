"use client";

import { KeyRound } from "lucide-react";
import {
  describeVerificationKeyMismatch,
  type VerificationKeyMismatch,
} from "@/lib/zk/verificationKeyMismatch";

/**
 * Explains a verification key mismatch without exposing proof or payroll data
 * (#763). Only shortened key fingerprints and the circuit version are shown.
 */
export function VerificationKeyMismatchDetails({ mismatch }: { mismatch: VerificationKeyMismatch }) {
  const view = describeVerificationKeyMismatch(mismatch);

  return (
    <div
      role="alert"
      data-testid="verification-key-mismatch"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800">Verification key mismatch</p>
        <p className="mt-1 text-sm text-red-700">{view.summary}</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-red-800 sm:grid-cols-3">
          <div>
            <dt className="font-medium uppercase">Expected key</dt>
            <dd className="font-mono" data-testid="vk-expected">{view.expected ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="font-medium uppercase">Proof&apos;s key</dt>
            <dd className="font-mono" data-testid="vk-reported">{view.reported ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt className="font-medium uppercase">Circuit version</dt>
            <dd className="font-mono" data-testid="vk-circuit">{view.circuitVersion ?? "Unavailable"}</dd>
          </div>
        </dl>
        {view.fingerprintsLookEqual && (
          <p className="mt-2 text-xs text-red-700">
            The shortened fingerprints look the same; the full key ids differ.
          </p>
        )}
        <p className="mt-3 text-xs font-medium text-red-800">Next steps</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-red-700">
          {view.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-red-600">
          Proof contents, witness data and payroll amounts are never shown here.
        </p>
      </div>
    </div>
  );
}

export default VerificationKeyMismatchDetails;

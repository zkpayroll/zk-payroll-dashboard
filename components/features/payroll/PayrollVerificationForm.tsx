"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ProofReferenceInput } from "@/components/features/proofs/ProofReferenceInput";
import { validateProofReference } from "@/lib/validation/proofReference";

/**
 * Standalone verification screen for checking a payroll proof reference
 * before it's relied on elsewhere in the dashboard. Submission is disabled
 * until the reference passes format validation.
 */
export function PayrollVerificationForm() {
  const [reference, setReference] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateProofReference(reference);
    if (!result.isValid) return;

    setLastVerified(result.normalized);
    toast.success("Proof reference verified", {
      description: result.normalized,
    });
  };

  return (
    <section aria-labelledby="verify-heading" className="space-y-6 max-w-lg">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        <h2 id="verify-heading" className="text-lg font-semibold text-gray-900">
          Verify Proof Reference
        </h2>
      </div>
      <p className="text-sm text-gray-500">
        Check a payroll proof reference format before using it in a verification
        or reconciliation action.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <ProofReferenceInput
          value={reference}
          onChange={setReference}
          onValidityChange={setIsValid}
          autoFocus
        />

        <button
          type="submit"
          disabled={!isValid}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Verify reference
        </button>

        {lastVerified && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Last verified: <span className="font-mono">{lastVerified}</span>
            </span>
          </div>
        )}
      </form>
    </section>
  );
}

export default PayrollVerificationForm;

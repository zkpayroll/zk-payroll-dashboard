"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProofReferenceInput } from "@/components/features/proofs/ProofReferenceInput";
import { validateProofReference } from "@/lib/validation/proofReference";
import { PAYROLL_NOTE_HASH_PATTERN, verifyPayrollNoteHash } from "@/lib/payroll/noteHash";

/**
 * Standalone verification screen for checking a payroll proof reference
 * before it's relied on elsewhere in the dashboard. Submission is disabled
 * until the reference passes format validation.
 */
export function PayrollVerificationForm() {
  const [reference, setReference] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expectedHash, setExpectedHash] = useState("");
  const [noteResult, setNoteResult] = useState<"match" | "mismatch" | "invalid-hash" | null>(null);
  const [isVerifyingNote, setIsVerifyingNote] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateProofReference(reference);
    if (!result.isValid) return;

    setLastVerified(result.normalized);
    toast.success("Proof reference verified", {
      description: result.normalized,
    });
  };

  const handleNoteVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteResult(null);
    setIsVerifyingNote(true);
    try {
      const result = await verifyPayrollNoteHash(note, expectedHash);
      setNoteResult(result.status);
    } catch {
      toast.error("Could not verify note hash", {
        description: "This browser does not support the Web Crypto API.",
      });
    } finally {
      setIsVerifyingNote(false);
    }
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

      <form onSubmit={handleNoteVerify} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Verify Payroll Note Hash</h3>
          <p className="mt-1 text-sm text-gray-500">
            Compare a note with its SHA-256 digest. The note is hashed in your browser and is not uploaded.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="payroll-note" className="block text-sm font-medium text-gray-700">Payroll note</label>
          <textarea
            id="payroll-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteResult(null); }}
            rows={4}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Paste the exact note text"
          />
          <p className="text-xs text-gray-500">Leading/trailing whitespace is ignored, matching the payroll note hasher. Internal whitespace and line breaks are significant.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="expected-note-hash" className="block text-sm font-medium text-gray-700">Expected SHA-256 hash</label>
          <input
            id="expected-note-hash"
            type="text"
            value={expectedHash}
            onChange={(e) => { setExpectedHash(e.target.value); setNoteResult(null); }}
            required
            aria-invalid={expectedHash.length > 0 && !PAYROLL_NOTE_HASH_PATTERN.test(expectedHash.trim())}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="64-character hex digest (optional 0x prefix)"
          />
          {expectedHash.length > 0 && !PAYROLL_NOTE_HASH_PATTERN.test(expectedHash.trim()) && (
            <p role="alert" className="text-xs text-red-600">Enter a 64-character SHA-256 hex digest.</p>
          )}
        </div>
        <button
          type="submit"
          disabled={!note || !PAYROLL_NOTE_HASH_PATTERN.test(expectedHash.trim()) || isVerifyingNote}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVerifyingNote && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isVerifyingNote ? "Verifying…" : "Verify note hash"}
        </button>
        {noteResult === "match" && (
          <div role="status" className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Note matches the expected SHA-256 hash.
          </div>
        )}
        {noteResult === "mismatch" && (
          <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> Note does not match the expected SHA-256 hash.
          </div>
        )}
        {noteResult === "invalid-hash" && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Expected hash must be a 64-character SHA-256 hex digest.
          </div>
        )}
      </form>
    </section>
  );
}

export default PayrollVerificationForm;

"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, XCircle } from "lucide-react";

import type { AttestationDigest, AttestationDigestState } from "@/types/audit";
import { digestsMatch, evaluateAttestationDigest, normalizeDigest } from "@/stores/auditDigest";

export interface AttestationDigestViewerProps {
  digest: AttestationDigest;
  onCopy?: (digest: string) => void;
  className?: string;
}

const STATE_LABELS: Record<AttestationDigestState, string> = {
  verified: "Verified",
  mismatch: "Digest mismatch",
  pending: "Pending verification",
  incomplete: "Incomplete metadata",
  incompatible: "Incompatible schema",
};

const STATE_STYLES: Record<AttestationDigestState, string> = {
  verified: "bg-green-50 text-green-700 border-green-200",
  mismatch: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-blue-50 text-blue-700 border-blue-200",
  incomplete: "bg-amber-50 text-amber-700 border-amber-200",
  incompatible: "bg-amber-50 text-amber-700 border-amber-200",
};

function StateIcon({ state }: { state: AttestationDigestState }) {
  if (state === "verified") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (state === "mismatch") return <XCircle className="h-4 w-4" aria-hidden="true" />;
  if (state === "pending") return <Clock className="h-4 w-4" aria-hidden="true" />;
  return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

/**
 * Shows an audit attestation digest with its schema version, period, scope
 * and verification state (#320). Only metadata and references are rendered;
 * salary rows are never part of the digest record, so none can be shown.
 */
export function AttestationDigestViewer({
  digest,
  onCopy,
  className = "",
}: AttestationDigestViewerProps) {
  const [copied, setCopied] = useState(false);
  const [compareValue, setCompareValue] = useState("");

  const { state, warnings } = evaluateAttestationDigest(digest);
  const digestValue = digest.digest ? normalizeDigest(digest.digest) : "";
  const scope = digest.scope;
  const compareResult = compareValue.trim()
    ? digestsMatch(digestValue, compareValue)
      ? "match"
      : "mismatch"
    : null;

  const handleCopy = async () => {
    if (!digestValue) return;
    try {
      await navigator.clipboard.writeText(digestValue);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); still confirm.
    }
    setCopied(true);
    onCopy?.(digestValue);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      data-testid="attestation-digest-viewer"
      aria-label="Audit attestation digest"
      className={`rounded-lg border border-gray-200 bg-white p-4 space-y-4 ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Attestation digest</h3>
        <span
          data-testid="digest-verification-state"
          data-state={state}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}
        >
          <StateIcon state={state} />
          {STATE_LABELS[state]}
        </span>
      </header>

      {warnings.length > 0 && (
        <ul
          data-testid="digest-warnings"
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1"
        >
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Digest</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code
              data-testid="digest-value"
              className="break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-800"
            >
              {digestValue || "—"}
            </code>
            <button
              type="button"
              data-testid="copy-digest-btn"
              onClick={handleCopy}
              disabled={!digestValue}
              aria-label={copied ? "Copied digest" : "Copy digest to clipboard"}
              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Schema version</dt>
          <dd data-testid="digest-schema-version" className="mt-1 text-gray-800">
            {digest.schemaVersion ?? "—"}
            {digest.algorithm ? ` (${digest.algorithm})` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Period</dt>
          <dd data-testid="digest-period" className="mt-1 text-gray-800">
            {digest.period?.start && digest.period?.end
              ? `${formatDate(digest.period.start)} – ${formatDate(digest.period.end)}`
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Scope</dt>
          <dd data-testid="digest-scope" className="mt-1 text-gray-800">
            {scope?.companyId ? (
              <>
                {scope.companyId} · {scope.payrollRunIds?.length ?? 0} payroll run
                {scope.payrollRunIds?.length === 1 ? "" : "s"}
                {scope.employeeCount !== undefined ? ` · ${scope.employeeCount} employees` : ""}
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="space-y-1">
        <label htmlFor={`digest-compare-${digest.id}`} className="text-xs text-gray-500">
          Compare with a digest reference
        </label>
        <input
          id={`digest-compare-${digest.id}`}
          data-testid="digest-compare-input"
          value={compareValue}
          onChange={(event) => setCompareValue(event.target.value)}
          placeholder="Paste a digest to compare"
          className="w-full rounded border border-gray-200 px-2 py-1 font-mono text-xs"
        />
        {compareResult && (
          <p
            data-testid="digest-compare-result"
            data-result={compareResult}
            className={`text-xs ${compareResult === "match" ? "text-green-700" : "text-red-700"}`}
          >
            {compareResult === "match"
              ? "References match."
              : "References do not match."}
          </p>
        )}
      </div>
    </section>
  );
}

export default AttestationDigestViewer;

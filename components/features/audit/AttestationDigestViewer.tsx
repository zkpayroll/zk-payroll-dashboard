"use client";

import { useState, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  GitCompare,
  X,
  FileText,
  Clock,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AttestationDigestMetadata,
  AttestationDigestValidationResult,
} from "@/types/audit";
import { validateDigestMetadata } from "@/types/audit";

const VERIFICATION_STYLES: Record<
  AttestationDigestMetadata["verificationState"],
  { bg: string; text: string; icon: typeof Shield; label: string }
> = {
  verified: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: ShieldCheck,
    label: "Verified",
  },
  mismatch: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: ShieldAlert,
    label: "Mismatch",
  },
  missing: {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    icon: AlertTriangle,
    label: "Missing",
  },
  incomplete: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    icon: Info,
    label: "Incomplete",
  },
};

function DigestCopyButton({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      toast.success("Digest copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy digest");
    }
  }, [digest]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors"
      aria-label="Copy digest reference"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

function WarningsList({
  validation,
}: {
  validation: AttestationDigestValidationResult;
}) {
  if (validation.warnings.length === 0 && validation.errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" role="alert" aria-label="Attestation warnings">
      {validation.errors.map((err, i) => (
        <div
          key={`err-${i}`}
          className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <span className="text-sm text-red-800">{err}</span>
        </div>
      ))}
      {validation.warnings.map((warn, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <span className="text-sm text-amber-800">{warn}</span>
        </div>
      ))}
    </div>
  );
}

function DigestScopeTable({
  scope,
}: {
  scope: AttestationDigestMetadata["scope"];
}) {
  const allItems = [
    ...scope.included.map((item) => ({ item, status: "included" as const })),
    ...scope.excluded.map((item) => ({ item, status: "excluded" as const })),
  ];

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm" aria-label="Digest scope">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
              Item
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {allItems.map(({ item, status }) => (
            <tr key={item} className="bg-white">
              <td className="px-4 py-2 font-mono text-gray-900">{item}</td>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                    status === "included"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {status === "included" ? "Included" : "Excluded"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparePanel({
  digests,
  onClose,
}: {
  digests: AttestationDigestMetadata[];
  onClose: () => void;
}) {
  const [leftId, setLeftId] = useState(digests[0]?.digest ?? "");
  const [rightId, setRightId] = useState(digests[1]?.digest ?? "");

  const left = digests.find((d) => d.digest === leftId);
  const right = digests.find((d) => d.digest === rightId);

  const differences: string[] = [];
  if (left && right) {
    if (left.schemaVersion !== right.schemaVersion)
      differences.push(`Schema version: "${left.schemaVersion}" vs "${right.schemaVersion}"`);
    if (left.period !== right.period)
      differences.push(`Period: "${left.period || "(empty)"}" vs "${right.period || "(empty)"}"`);
    if (left.verificationState !== right.verificationState)
      differences.push(`Verification state: "${left.verificationState}" vs "${right.verificationState}"`);
    if (
      left.scope.included.join(",") !== right.scope.included.join(",")
    )
      differences.push("Scope included items differ.");
    if (
      left.scope.excluded.join(",") !== right.scope.excluded.join(",")
    )
      differences.push("Scope excluded items differ.");
  }

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4" role="region" aria-label="Compare digests">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Compare Digests</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600"
          aria-label="Close comparison"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="compare-left" className="block text-xs font-medium text-gray-600 mb-1">
            Digest A
          </label>
          <select
            id="compare-left"
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            {digests.map((d) => (
              <option key={d.digest} value={d.digest}>
                {d.digest.slice(0, 18)}... ({d.schemaVersion || "?"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="compare-right" className="block text-xs font-medium text-gray-600 mb-1">
            Digest B
          </label>
          <select
            id="compare-right"
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            {digests.map((d) => (
              <option key={d.digest} value={d.digest}>
                {d.digest.slice(0, 18)}... ({d.schemaVersion || "?"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {differences.length === 0 ? (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
          No differences found — these digests are identical.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600 uppercase">Differences</p>
          <ul className="space-y-1">
            {differences.map((diff, i) => (
              <li
                key={i}
                className="text-sm text-gray-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5"
              >
                {diff}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface AttestationDigestViewerProps {
  digests?: AttestationDigestMetadata[];
  isLoading?: boolean;
}

export default function AttestationDigestViewer({
  digests = [],
  isLoading = false,
}: AttestationDigestViewerProps) {
  const [selectedDigest, setSelectedDigest] = useState<AttestationDigestMetadata | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const handleSelectDigest = useCallback(
    (digest: AttestationDigestMetadata) => {
      setSelectedDigest(
        selectedDigest?.digest === digest.digest ? null : digest,
      );
    },
    [selectedDigest],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (digests.length === 0) {
    return (
      <div className="text-center py-10" role="status">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          No attestation digests available.
        </p>
      </div>
    );
  }

  const selectedValidation = selectedDigest
    ? validateDigestMetadata(selectedDigest)
    : null;

  return (
    <section aria-labelledby="attestation-digest-heading" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            id="attestation-digest-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Attestation Digests
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Review audit attestation digests, scope metadata, schema versions,
            and verification status. Raw payroll data is never exposed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCompare(!showCompare)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          aria-label={showCompare ? "Hide comparison panel" : "Compare two digests"}
        >
          <GitCompare className="w-3.5 h-3.5" />
          {showCompare ? "Hide Compare" : "Compare"}
        </button>
      </div>

      {showCompare && (
        <ComparePanel
          digests={digests}
          onClose={() => setShowCompare(false)}
        />
      )}

      <div className="space-y-3" role="list" aria-label="Attestation digest list">
        {digests.map((digest) => {
          const style = VERIFICATION_STYLES[digest.verificationState];
          const Icon = style.icon;
          const validation = validateDigestMetadata(digest);

          return (
            <div
              key={digest.digest}
              role="listitem"
              className={`rounded-lg border transition-colors ${
                selectedDigest?.digest === digest.digest
                  ? "ring-2 ring-indigo-200 border-indigo-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectDigest(digest)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                aria-expanded={selectedDigest?.digest === digest.digest}
                aria-label={`View details for digest ${digest.digest.slice(0, 16)}...`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-gray-900 truncate">
                      {digest.digest.slice(0, 20)}...
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text}`}
                    >
                      <Icon className="w-3 h-3" />
                      {style.label}
                    </span>
                    {validation.warnings.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                        {validation.warnings.length} warning{validation.warnings.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>Schema v{digest.schemaVersion || "—"}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {digest.period || "No period"}
                    </span>
                    {digest.referencedBy && (
                      <span className="truncate max-w-[200px]">
                        Ref: {digest.referencedBy}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {selectedDigest?.digest === digest.digest && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                  <div className="pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                          Digest Reference
                        </label>
                        <div className="flex items-center gap-2">
                          <code className="block flex-1 bg-gray-50 rounded-md px-3 py-2 text-xs font-mono text-gray-800 break-all border">
                            {digest.digest}
                          </code>
                          <DigestCopyButton digest={digest.digest} />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                            Schema Version
                          </label>
                          <p className="text-sm text-gray-900 font-medium">
                            {digest.schemaVersion || (
                              <span className="text-red-600 italic">Not set</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                            Period
                          </label>
                          <p className="text-sm text-gray-900">
                            {digest.period || (
                              <span className="text-amber-600 italic">Not specified</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                        Verification State
                      </label>
                      <p className={`text-sm font-medium ${style.text}`}>
                        {style.label}
                        {digest.verifiedAt && (
                          <span className="font-normal text-gray-500 ml-2">
                            on {new Date(digest.verifiedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                        Scope
                      </label>
                      <DigestScopeTable scope={digest.scope} />
                    </div>

                    {selectedValidation && (
                      <WarningsList validation={selectedValidation} />
                    )}

                    <div className="text-xs text-gray-500 border-t pt-2 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      Raw payroll rows are never displayed in this view.
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

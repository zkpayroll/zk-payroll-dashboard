"use client";

import { useState, useCallback } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileWarning,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  inspectPayload,
  buildCopySafeSummary,
  type PayloadSummary,
} from "@/lib/privacy/inspector";

interface PayloadInspectorProps {
  /** Raw payload object to inspect (e.g. a PayrollRun or Soroban call). */
  payload: Record<string, unknown>;
  /** Optional title override for the panel heading. */
  heading?: string;
  /** Allow toggling private-field visibility (requires appropriate role). */
  allowReveal?: boolean;
  /** Called when the user copies the safe summary. */
  onCopy?: () => void;
  className?: string;
}

export function PayloadInspector({
  payload,
  heading,
  allowReveal = false,
  onCopy,
  className = "",
}: PayloadInspectorProps) {
  const [showPrivate, setShowPrivate] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary: PayloadSummary = inspectPayload(payload, {
    showPrivate,
  });

  const handleCopy = useCallback(async () => {
    // Always copy the redacted version regardless of reveal state.
    const text = buildCopySafeSummary(payload);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be blocked; fail silently.
    }
  }, [payload, onCopy]);

  return (
    <div
      className={`border rounded-xl bg-white shadow-sm overflow-hidden ${className}`}
      role="region"
      aria-label="Payload Inspector"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0" />
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {heading ?? summary.title}
          </h2>
          {!summary.isRecognized && (
            <StatusBadge status="failed" className="ml-2" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allowReveal && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowPrivate((v) => !v)}
              aria-label={showPrivate ? "Hide private fields" : "Reveal private fields"}
            >
              {showPrivate ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Reveal
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={handleCopy}
            aria-label="Copy safe summary"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy Summary
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 space-y-1.5">
          {summary.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unknown payload warning */}
      {!summary.isRecognized && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2 text-sm text-red-800">
            <FileWarning className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This payload type is not recognized by the inspector. Do not sign
              unless you fully understand the contents.
            </span>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="divide-y">
        {summary.sections.map((section, si) => (
          <div key={si} className="px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {section.title}
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {section.fields.map((f, fi) => (
                <div key={fi} className="flex items-baseline gap-2 min-w-0">
                  <dt className="text-xs text-gray-500 shrink-0">{f.label}:</dt>
                  <dd className="text-sm text-gray-900 font-mono truncate flex items-center gap-1">
                    {f.sensitive && !showPrivate ? (
                      <>
                        <Lock className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="text-gray-400 italic">{f.value}</span>
                      </>
                    ) : (
                      <span>{f.value}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <span>
          {summary.redactedFieldCount > 0
            ? `${summary.redactedFieldCount} private field(s) redacted`
            : "No private fields detected"}
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Copy-safe summary excludes all private data
        </span>
      </div>
    </div>
  );
}

export default PayloadInspector;

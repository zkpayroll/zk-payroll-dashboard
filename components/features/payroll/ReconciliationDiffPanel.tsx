"use client";

import { useMemo, useState, useCallback } from "react";
import { Clipboard, ClipboardCheck, Terminal, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatReconciliationDiff } from "@/lib/reconciliation/format";
import { buildReconciliationDiff } from "@/lib/reconciliation/mockObserved";
import type { Employee, PayrollRun } from "@/types/models";

export interface ReconciliationDiffPanelProps {
  /** The payroll run whose expected outcomes should be reconciled. */
  run: PayrollRun;
  /** Employees that participated in the run. */
  employees: Employee[];
  /** Optional clock for deterministic synthesis in tests. */
  now?: number;
}

/**
 * Operator-facing reconciliation diff card.
 *
 * Pulls the SDK-shaped diff between expected outcomes and observed
 * on-chain state (synthesized for the dashboard demo), renders the
 * grep-friendly string, and offers a one-click copy affordance for
 * pasting into Slack or a log file.
 *
 * The card is visually distinguished as an "operator view" with an
 * inline privacy warning so casual viewers don't accidentally read
 * the per-recipient stroop amounts during normal dashboard browsing.
 */
export default function ReconciliationDiffPanel({
  run,
  employees,
  now,
}: ReconciliationDiffPanelProps) {
  const [copied, setCopied] = useState(false);

  const { diffText, isFullyReconciled } = useMemo(() => {
    const result = buildReconciliationDiff(run, employees, now);
    return {
      diffText: formatReconciliationDiff(result),
      isFullyReconciled: result.isFullyReconciled,
    };
  }, [run, employees, now]);

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diffText);
      } else {
        // Fallback for browsers without the async Clipboard API.
        const ta = document.createElement("textarea");
        ta.value = diffText;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Reconciliation diff copied", {
        description: "Ready to paste into a log file or chat thread.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Could not copy diff", {
        description: err instanceof Error ? err.message : "Clipboard unavailable.",
      });
    }
  }, [diffText]);

  const summary = isFullyReconciled
    ? "All payments reconcile cleanly"
    : "Differences detected — review the diff below";

  return (
    <section
      data-testid="reconciliation-diff-panel"
      aria-label="Operator reconciliation diff"
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-gray-50">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Terminal className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          Operator view (contains unredacted stroops)
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              isFullyReconciled
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {summary}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy reconciliation diff"}
            data-testid="reconciliation-diff-copy"
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1 transition-colors border border-slate-700"
          >
            {copied ? (
              <>
                <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Clipboard className="w-3.5 h-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>
      </header>
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 text-xs text-gray-600">
          <ShieldAlert
            className="w-4 h-4 mt-0.5 text-amber-500 shrink-0"
            aria-hidden="true"
          />
          <p>
            This view is intended for operators triaging a run. It surfaces
            per-recipient reconciliation status and per-stroop amounts
            that are not shown elsewhere on this page. Do not share outside
            the operations team.
          </p>
        </div>

        <div className="relative bg-slate-900 rounded-md overflow-hidden">
          <pre
            data-testid="reconciliation-diff-text"
            className="text-slate-100 text-xs font-mono leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap break-words"
          >
            {diffText}
          </pre>
        </div>
      </div>
    </section>
  );
}
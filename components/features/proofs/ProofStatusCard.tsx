"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useProofStatusStore,
  SAFE_STATUS_EXPLANATIONS,
  type ProofLifecycleState,
} from "@/stores/proofStatus";
import { ProofLifecycleTimeline } from "./ProofLifecycleTimeline";

const BADGE_CONFIG: Record<
  ProofLifecycleState,
  { icon: LucideIcon; label: string; containerClass: string }
> = {
  queued: {
    icon: Clock,
    label: "Queued",
    containerClass: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  generating: {
    icon: Cpu,
    label: "Generating Proof",
    containerClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  ready: {
    icon: ShieldCheck,
    label: "Ready for Execution",
    containerClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  submitted: {
    icon: Send,
    label: "Submitted On-Chain",
    containerClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  },
  verified: {
    icon: CheckCircle2,
    label: "Verified On-Chain",
    containerClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  failed: {
    icon: XCircle,
    label: "Proof Failed",
    containerClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  expired: {
    icon: AlertTriangle,
    label: "Proof Expired",
    containerClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
};

export interface ProofStatusCardProps {
  /** Optional override for standalone or controlled rendering */
  statusOverride?: ProofLifecycleState;
  onRegenerateProof?: () => void;
  onSubmitTransaction?: () => void;
}

export function ProofStatusCard({
  statusOverride,
  onRegenerateProof,
  onSubmitTransaction,
}: ProofStatusCardProps) {
  const store = useProofStatusStore();

  const currentStatus = statusOverride ?? store.status;
  const badge = BADGE_CONFIG[currentStatus];
  const Icon = badge.icon;
  const explanation = SAFE_STATUS_EXPLANATIONS[currentStatus](store);

  return (
    <div
      data-testid="proof-status-card"
      data-proof-status={currentStatus}
      className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
    >
      {/* Header section with Badge */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-900">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              ZK Proof Status
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Private payroll validity & on-chain verification progress
            </p>
          </div>
        </div>

        <div
          data-testid={`proof-status-badge-${currentStatus}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badge.containerClass}`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${currentStatus === "generating" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Timeline view */}
      <ProofLifecycleTimeline status={currentStatus} />

      {/* Progress Bar for Generating State */}
      {currentStatus === "generating" && (
        <div data-testid="proof-generation-progress" className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Synthesizing Zero-Knowledge Proof...</span>
            <span className="font-semibold tabular-nums">{Math.round(store.progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
              style={{ width: `${Math.max(5, store.progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Explanation Box */}
      <div
        data-testid="proof-explanation-box"
        className="flex flex-col gap-1.5 rounded-lg border border-gray-100 bg-gray-50/75 p-3.5 dark:border-gray-800/80 dark:bg-gray-900/50"
      >
        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
          {explanation.title}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          {explanation.description}
        </div>

        {explanation.nextStepGuidance && (
          <div
            data-testid="next-step-guidance"
            className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400 border-t border-gray-200/60 pt-2 dark:border-gray-800"
          >
            <span className="font-semibold">Next Step: </span>
            {explanation.nextStepGuidance}
          </div>
        )}
      </div>

      {/* Privacy Safeguard Disclaimer */}
      <div className="flex items-start gap-2 rounded-md bg-blue-50/50 p-2.5 text-[11px] text-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        <Lock className="h-3.5 w-3.5 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Zero-Knowledge Guarantee:</strong> Individual salary figures,
          SSNs, and private keys are never exposed in proof data or stored on-chain.
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {(currentStatus === "failed" || currentStatus === "expired") && (
          <button
            type="button"
            data-testid="regenerate-proof-button"
            onClick={onRegenerateProof || store.startGenerating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Regenerate Proof
          </button>
        )}

        {currentStatus === "ready" && (
          <button
            type="button"
            data-testid="submit-transaction-button"
            onClick={onSubmitTransaction || (() => store.markSubmitted("0x9a8f..."))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Submit Transaction
          </button>
        )}
      </div>
    </div>
  );
}

export default ProofStatusCard;

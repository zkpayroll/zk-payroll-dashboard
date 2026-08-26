"use client";

import { CheckCircle2, AlertTriangle, Clock, Cpu, Send, ShieldCheck, XCircle } from "lucide-react";
import type { ProofLifecycleState } from "@/stores/proofStatus";

interface ProofLifecycleTimelineProps {
  status: ProofLifecycleState;
}

interface StepConfig {
  id: ProofLifecycleState;
  label: string;
  icon: typeof CheckCircle2;
}

const STAGES: StepConfig[] = [
  { id: "queued", label: "Queued", icon: Clock },
  { id: "generating", label: "Generating", icon: Cpu },
  { id: "ready", label: "Ready", icon: ShieldCheck },
  { id: "submitted", label: "Submitted", icon: Send },
  { id: "verified", label: "Verified", icon: CheckCircle2 },
];

const ORDER: Record<ProofLifecycleState, number> = {
  queued: 0,
  generating: 1,
  ready: 2,
  submitted: 3,
  verified: 4,
  failed: -1,
  expired: -1,
};

export function ProofLifecycleTimeline({ status }: ProofLifecycleTimelineProps) {
  const currentIndex = ORDER[status];
  const isFailed = status === "failed";
  const isExpired = status === "expired";

  return (
    <div
      data-testid="proof-lifecycle-timeline"
      className="w-full rounded-lg bg-gray-50 p-4 border border-gray-200 dark:bg-gray-900 dark:border-gray-800"
    >
      <div className="flex items-center justify-between">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCurrent = status === stage.id;
          const isCompleted = currentIndex > idx;
          const isUpcoming = currentIndex < idx && !isFailed && !isExpired;

          let circleStyle = "bg-gray-100 text-gray-400 border-gray-300 dark:bg-gray-800 dark:text-gray-500";
          let labelStyle = "text-gray-400 dark:text-gray-500";

          if (isCompleted) {
            circleStyle = "bg-green-100 text-green-700 border-green-400 dark:bg-green-950 dark:text-green-400";
            labelStyle = "text-green-700 dark:text-green-400 font-medium";
          } else if (isCurrent) {
            circleStyle =
              "bg-blue-100 text-blue-700 border-blue-500 ring-2 ring-blue-300 dark:bg-blue-950 dark:text-blue-400";
            labelStyle = "text-blue-700 dark:text-blue-400 font-semibold";
          } else if (isUpcoming) {
            circleStyle = "bg-gray-100 text-gray-400 border-gray-300 dark:bg-gray-800 dark:text-gray-600";
          }

          return (
            <div key={stage.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  data-testid={`timeline-step-${stage.id}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors ${circleStyle}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <span className={`text-xs ${labelStyle}`}>{stage.label}</span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-colors ${
                    isCompleted
                      ? "bg-green-400 dark:bg-green-600"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {(isFailed || isExpired) && (
        <div
          data-testid="timeline-error-callout"
          className={`mt-4 flex items-center gap-2 rounded-md p-2.5 text-xs font-medium border ${
            isFailed
              ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          }`}
        >
          {isFailed ? (
            <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          )}
          <span>
            {isFailed
              ? "Proof generation halted due to an evaluation issue. Follow guidance below to retry."
              : "Proof timestamp expired before on-chain execution. Regenerate proof to continue."}
          </span>
        </div>
      )}
    </div>
  );
}

export default ProofLifecycleTimeline;

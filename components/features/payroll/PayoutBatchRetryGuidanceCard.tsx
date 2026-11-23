"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
  ArrowRight,
  Shield,
} from "lucide-react";
import type { PayoutBatchRetryGuidance } from "@/lib/payroll/payoutBatchRetryGuidance";
import { RETRY_DECISION_OUTCOME_LABELS } from "@/lib/payroll/payoutBatchRetryGuidance";

interface PayoutBatchRetryGuidanceCardProps {
  guidance: PayoutBatchRetryGuidance;
  className?: string;
  onActionClick?: () => void;
}

export function PayoutBatchRetryGuidanceCard({
  guidance,
  className = "",
  onActionClick,
}: PayoutBatchRetryGuidanceCardProps) {
  const isAllowed = guidance.outcome === "allowed";
  const isBlocked = guidance.outcome === "blocked";
  const isDeferred = guidance.outcome === "deferred";

  const containerStyle = isAllowed
    ? "border-green-200 bg-green-50 text-green-950"
    : isBlocked
    ? "border-red-200 bg-red-50 text-red-950"
    : "border-amber-200 bg-amber-50 text-amber-950";

  const badgeStyle = isAllowed
    ? "bg-green-100 text-green-800 border-green-200"
    : isBlocked
    ? "bg-red-100 text-red-800 border-red-200"
    : "bg-amber-100 text-amber-800 border-amber-200";

  const Icon = isAllowed ? CheckCircle : isBlocked ? Ban : Clock;
  const iconColor = isAllowed
    ? "text-green-600"
    : isBlocked
    ? "text-red-600"
    : "text-amber-600";

  return (
    <section
      role="status"
      data-testid="payout-batch-retry-guidance-card"
      data-outcome={guidance.outcome}
      data-reason={guidance.reason}
      className={`rounded-lg border p-4 space-y-3 ${containerStyle} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">
                {guidance.title}
              </h3>
              <span
                data-testid="retry-outcome-badge"
                className={`px-2 py-0.5 rounded text-xs font-semibold border ${badgeStyle}`}
              >
                {RETRY_DECISION_OUTCOME_LABELS[guidance.outcome]}
              </span>
              <span className="font-mono text-xs opacity-75">
                ({guidance.reason} · attempt {guidance.attempt} of {guidance.maxAttempts})
              </span>
            </div>
            <p className="text-xs opacity-90 mt-1">
              {guidance.message}
            </p>
          </div>
        </div>

        <span className="text-xs opacity-75 font-mono shrink-0">
          {guidance.payrollId}
        </span>
      </div>

      <div className="rounded-md bg-white/70 border border-current/10 p-3 space-y-2 text-xs">
        <div>
          <h4 className="font-semibold uppercase tracking-wider text-[11px] opacity-80">
            Actionable Guidance
          </h4>
          <p
            data-testid="retry-guidance-text"
            className="mt-0.5 font-medium leading-relaxed"
          >
            {guidance.guidance}
          </p>
        </div>

        {guidance.nextSteps.length > 0 && (
          <div>
            <h4 className="font-semibold uppercase tracking-wider text-[11px] opacity-80 mt-2">
              Recommended Next Steps
            </h4>
            <ol
              data-testid="retry-guidance-next-steps"
              className="mt-1 list-decimal pl-4 space-y-0.5"
            >
              {guidance.nextSteps.map((step, idx) => (
                <li key={idx} className="leading-normal">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-current/10 flex-wrap">
          {guidance.remediationHref ? (
            <Link
              href={guidance.remediationHref}
              onClick={onActionClick}
              data-testid="retry-remediation-link"
              className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80 text-xs"
            >
              {guidance.remediationLabel ?? "Take Remediation Action"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span className="text-[11px] opacity-75">
              Attempts remaining: {guidance.remainingAttempts}
            </span>
          )}

          <span className="text-[11px] opacity-60 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Privacy safe: zero salary or employee data exposed
          </span>
        </div>
      </div>
    </section>
  );
}

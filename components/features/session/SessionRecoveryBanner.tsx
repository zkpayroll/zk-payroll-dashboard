"use client";

import { LogIn, RotateCcw, ArrowRight, ShieldCheck } from "lucide-react";
import {
  evaluateSessionExpiry,
  buildResumePlan,
  PAYROLL_WORKFLOW_LABELS,
  type RecoveryContext,
} from "@/src/session/timeoutRecovery";

export interface SessionRecoveryBannerProps {
  isExpired: boolean;
  /** Non-sensitive recovery context captured before the session expired. */
  context?: RecoveryContext | null;
  onReauth?: () => void;
  onResume?: (context: RecoveryContext) => void;
  onRestart?: () => void;
}

export function SessionRecoveryBanner({
  isExpired,
  context,
  onReauth,
  onResume,
  onRestart,
}: SessionRecoveryBannerProps) {
  const expiry = evaluateSessionExpiry(isExpired, context);
  if (!expiry.isExpired) return null;

  const plan = buildResumePlan(context);
  const canResume = expiry.availableActions.includes("resume") && context;

  return (
    <div
      role="alert"
      data-testid="session-recovery-banner"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm space-y-3"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900">Session Expired</p>
          <p className="text-amber-800 mt-0.5">{expiry.guidance}</p>
          {context && (
            <p className="text-xs text-amber-700 mt-1" data-testid="session-recovery-context">
              Saved context: {PAYROLL_WORKFLOW_LABELS[context.workflow]}
              {context.stepLabel ? ` — ${context.stepLabel}` : ""} · {context.route}
            </p>
          )}
        </div>
      </div>

      {canResume && (
        <ol
          className="ml-8 list-decimal list-inside space-y-0.5 text-xs text-amber-800"
          data-testid="session-resume-steps"
        >
          {plan.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      )}

      <div className="ml-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReauth}
          className="flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign In Again
        </button>
        {canResume && context && (
          <button
            type="button"
            onClick={() => onResume?.(context)}
            className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Resume Where I Left Off
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart Payroll Flow
        </button>
      </div>

      <p className="ml-8 text-[11px] text-amber-700">
        Recovery context stores workflow position only — never salary values, amounts, or secrets.
      </p>
    </div>
  );
}

export default SessionRecoveryBanner;

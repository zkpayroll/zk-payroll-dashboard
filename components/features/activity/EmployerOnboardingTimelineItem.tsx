"use client";

import { Building2, CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react";
import type { PayrollEvent, IncidentTimelineEntry } from "@/src/observability";
import { ONBOARDING_STEP_LABELS, type EmployerOnboardingStep } from "@/lib/events/employerOnboarding";

export type EmployerOnboardingTimelineState = "completed" | "in_progress" | "failed" | "not_started";

export interface EmployerOnboardingTimelineItemProps {
  employerId: string;
  employerName: string;
  state: EmployerOnboardingTimelineState;
  currentStep?: EmployerOnboardingStep;
  timestamp?: string;
  errorMessage?: string;
  className?: string;
  /** Optional observability entry to derive display from a single event */
  entry?: IncidentTimelineEntry | PayrollEvent;
}

const STATE_CONFIG: Record<
  EmployerOnboardingTimelineState,
  { icon: typeof Building2; label: string; badgeClass: string; iconClass: string }
> = {
  completed: {
    icon: CheckCircle2,
    label: "Onboarding completed",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    iconClass: "text-green-600",
  },
  in_progress: {
    icon: Clock,
    label: "Onboarding in progress",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    iconClass: "text-blue-600",
  },
  failed: {
    icon: XCircle,
    label: "Onboarding failed",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    iconClass: "text-red-600",
  },
  not_started: {
    icon: Building2,
    label: "Onboarding not started",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    iconClass: "text-gray-400",
  },
};

function deriveStateFromEntry(entry: IncidentTimelineEntry | PayrollEvent): EmployerOnboardingTimelineState {
  if (entry.status === "succeeded") return "completed";
  if (entry.status === "failed") return "failed";
  if (entry.status === "started") return "in_progress";
  return "in_progress";
}

/**
 * Activity timeline item for employer onboarding events.
 * Privacy-safe: only employer name/id and step labels are shown.
 * No salary, treasury balance, or private payroll values are rendered.
 */
export function EmployerOnboardingTimelineItem({
  employerId,
  employerName,
  state,
  currentStep,
  timestamp,
  errorMessage,
  className = "",
  entry,
}: EmployerOnboardingTimelineItemProps) {
  const effectiveState = entry ? deriveStateFromEntry(entry) : state;
  const config = STATE_CONFIG[effectiveState];
  const Icon = config.icon;
  // PayrollEvent stores data in payload; IncidentTimelineEntry stores in redactedContext
  const entryPayload: Record<string, unknown> =
    entry && "payload" in entry
      ? (entry.payload as Record<string, unknown>)
      : entry && "redactedContext" in entry
      ? (entry.redactedContext as Record<string, unknown>)
      : {};
  const effectiveStep = (entryPayload?.step as EmployerOnboardingStep | undefined) ?? currentStep;
  const stepLabel = effectiveStep ? ONBOARDING_STEP_LABELS[effectiveStep] ?? effectiveStep : undefined;
  const effectiveTimestamp = entry?.timestamp ?? timestamp;
  const effectiveError = (entryPayload?.errorLabel as string | undefined) ?? errorMessage;
  const employerLabel = (entryPayload?.employerName as string | undefined) ?? employerName;

  return (
    <li
      data-testid="employer-onboarding-timeline-item"
      data-state={effectiveState}
      data-employer-id={employerId}
      className={`relative flex items-start gap-3 rounded-lg border bg-white p-4 shadow-sm ${className}`}
      aria-label={`Employer onboarding: ${employerLabel} - ${config.label}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${config.badgeClass}`}
        aria-hidden="true"
      >
        <Icon className={`h-5 w-5 ${config.iconClass}`} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Building2 className="h-3.5 w-3.5 text-gray-500" />
            Employer onboarding
          </span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}>
            {config.label}
          </span>
        </div>

        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium">{employerLabel}</span>
          {stepLabel ? <span className="text-gray-600"> — {stepLabel}</span> : null}
        </p>

        {effectiveTimestamp && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            {new Date(effectiveTimestamp).toLocaleString()}
          </p>
        )}

        {effectiveState === "failed" && effectiveError && (
          <p className="mt-2 rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
            {effectiveError}
          </p>
        )}

        {effectiveState === "completed" && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-green-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Setup verified — ready for payroll operations.
          </p>
        )}

        <p className="mt-2 text-xs text-gray-400">
          Employer ID: <span className="font-mono">{employerId}</span>
        </p>
      </div>
    </li>
  );
}

/**
 * Group container for employer onboarding timeline items.
 */
export function EmployerOnboardingTimeline({
  items,
  className = "",
}: {
  items: EmployerOnboardingTimelineItemProps[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        data-testid="employer-onboarding-empty"
        className={`rounded-lg border border-dashed p-6 text-center text-sm text-gray-500 ${className}`}
      >
        No employer onboarding activity recorded yet.
      </div>
    );
  }

  return (
    <ol
      aria-label="Employer onboarding activity timeline"
      className={`space-y-3 ${className}`}
      data-testid="employer-onboarding-timeline"
    >
      {items.map((item) => (
        <EmployerOnboardingTimelineItem key={`${item.employerId}-${item.currentStep ?? item.state}`} {...item} />
      ))}
    </ol>
  );
}

export default EmployerOnboardingTimelineItem;

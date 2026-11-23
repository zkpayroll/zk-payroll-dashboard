"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ShieldAlert } from "lucide-react";
import { evaluateCompensationPolicyEffectiveDate } from "@/lib/compensation/compensationPolicyEffectiveDate";
import {
  COMPENSATION_POLICY_STATUS_LABELS,
  type CompensationPolicyEffectiveDateCheck,
  type CompensationPolicyScheduleEntry,
} from "@/types/compensation";

export interface DashboardCompensationPolicyCheckProps {
  /**
   * Scheduled compensation policy revisions. When the prop is omitted the panel
   * falls back to a relative demo schedule so the dashboard always renders a
   * meaningful state; pass `[]` to exercise the "nothing scheduled" state.
   */
  policies?: CompensationPolicyScheduleEntry[] | null;
  /** Invoked when the remediation link is activated, for in-page flows. */
  onReviewClick?: () => void;
  className?: string;
}

const MS_PER_DAY = 86_400_000;

function addDays(reference: Date, days: number): string {
  const next = new Date(reference.getTime() + days * MS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

/**
 * Demo schedule used when no `policies` prop is supplied. Dates are relative to
 * today so the panel never drifts into a permanent error state as time passes,
 * and the schedule is deliberately healthy: one revision already in force plus
 * one future revision. Contains no compensation values.
 */
function buildDemoSchedule(): CompensationPolicyScheduleEntry[] {
  const today = new Date();

  return [
    {
      id: "comp_policy_current",
      effectiveDate: addDays(today, -45),
      status: "active",
    },
    {
      id: "comp_policy_next_review",
      effectiveDate: addDays(today, 30),
      status: "scheduled",
    },
  ];
}

function toneClass(status: "valid" | "warning" | "invalid"): string {
  if (status === "valid") return "border-green-200 bg-green-50";
  return "border-amber-200 bg-amber-50";
}

function StatusIcon({ status }: { status: "valid" | "warning" | "invalid" }) {
  if (status === "invalid") {
    return (
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
        aria-hidden="true"
      />
    );
  }
  if (status === "warning") {
    return (
      <ShieldAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
        aria-hidden="true"
      />
    );
  }
  return (
    <CheckCircle2
      className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
      aria-hidden="true"
    />
  );
}

function FindingList({
  findings,
  tone,
  testIdPrefix,
}: {
  findings: CompensationPolicyEffectiveDateCheck[];
  tone: string;
  testIdPrefix: string;
}) {
  return (
    <ul className="mt-2 space-y-2" data-testid={testIdPrefix}>
      {findings.map((finding, index) => (
        <li
          key={`${finding.id}-${finding.policyId ?? "schedule"}-${index}`}
          data-testid={`${testIdPrefix}-${finding.id}`}
          className={`rounded-md border border-transparent ${tone} px-3 py-2`}
        >
          <p className="text-xs font-semibold text-gray-900">{finding.title}</p>
          <p className="mt-0.5 text-xs text-gray-700">{finding.message}</p>
          {finding.remediation && (
            <p className="mt-0.5 text-xs text-gray-600">
              <span className="font-medium">Next step:</span>{" "}
              {finding.remediation}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Privacy-safe dashboard check that every compensation policy revision takes
 * effect on a valid, forward-only calendar date before any further compensation
 * change is scheduled.
 *
 * The panel only ever receives and renders policy ids, lifecycle statuses, and
 * effective dates — never salary amounts, employee identities, or payout
 * destinations — so it is safe to surface directly on the operations dashboard.
 */
export default function DashboardCompensationPolicyCheck({
  policies,
  onReviewClick,
  className = "",
}: DashboardCompensationPolicyCheckProps) {
  const resolvedPolicies =
    policies === undefined ? buildDemoSchedule() : (policies ?? []);

  const result = evaluateCompensationPolicyEffectiveDate(resolvedPolicies);
  const isValid = result.status === "valid";
  const isWarning = result.status === "warning";
  const tone = toneClass(result.status);

  const badge = isValid
    ? { label: "Ready", className: "bg-green-100 text-green-800" }
    : isWarning
      ? { label: "Notice", className: "bg-amber-100 text-amber-800" }
      : { label: "Action Required", className: "bg-amber-100 text-amber-800" };

  return (
    <section
      role="status"
      aria-labelledby="dashboard-compensation-policy-heading"
      className={`rounded-lg border p-4 transition-all ${tone} ${className}`}
      data-testid="dashboard-compensation-policy"
      data-status={result.status}
      data-can-schedule={
        result.canScheduleCompensationChanges ? "true" : "false"
      }
      data-error-count={result.errors.length}
      data-warning-count={result.warnings.length}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={result.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-compensation-policy-heading"
              className="text-sm font-semibold text-gray-900"
            >
              <CalendarClock
                className="mr-1.5 inline h-4 w-4 align-text-bottom"
                aria-hidden="true"
              />
              Compensation policy effective dates
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <p
            className={`mt-1 text-sm ${isValid ? "text-green-800" : "text-amber-800"}`}
            data-testid="dashboard-compensation-policy-summary"
          >
            {result.summaryMessage}
          </p>

          {result.nextEffectiveDate && (
            <p
              className="mt-1 text-xs text-gray-600"
              data-testid="dashboard-compensation-policy-next"
            >
              Next effective date:{" "}
              <span className="font-medium text-gray-900">
                {result.nextEffectiveDate}
              </span>{" "}
              {result.daysUntilNextEffectiveDate === 0
                ? "(today)"
                : `(${result.daysUntilNextEffectiveDate} ${
                    result.daysUntilNextEffectiveDate === 1 ? "day" : "days"
                  } away)`}
            </p>
          )}

          {result.errors.length > 0 && (
            <FindingList
              findings={result.errors}
              tone="bg-white/70"
              testIdPrefix="dashboard-compensation-policy-error"
            />
          )}

          {result.warnings.length > 0 && (
            <FindingList
              findings={result.warnings}
              tone="bg-white/70"
              testIdPrefix="dashboard-compensation-policy-warning"
            />
          )}

          {result.checkedPolicies.length > 0 && (
            <ul
              className="mt-3 flex flex-wrap gap-2"
              data-testid="dashboard-compensation-policy-list"
            >
              {result.checkedPolicies.map((policy) => (
                <li
                  key={policy.id}
                  data-testid={`dashboard-compensation-policy-item-${policy.id}`}
                  className="rounded-full border border-gray-200 bg-white/70 px-2.5 py-0.5 text-xs text-gray-700"
                >
                  <span className="font-medium text-gray-900">{policy.id}</span>
                  {" · "}
                  {COMPENSATION_POLICY_STATUS_LABELS[policy.status]}
                  {" from "}
                  <span className="font-mono">{policy.effectiveDate}</span>
                </li>
              ))}
            </ul>
          )}

          {result.remediationAction && (
            <div className="mt-3 flex items-center gap-3">
              <Link
                href={result.remediationAction.href}
                onClick={(event) => {
                  if (onReviewClick) {
                    event.preventDefault();
                    onReviewClick();
                  }
                }}
                className="inline-flex rounded text-sm font-medium text-amber-900 underline hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
              >
                {result.remediationAction.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  getPayrollFailureGuidance,
  type PayrollFailureCodeSeverity,
} from "@/lib/payroll/failureCodeGuidance";

// #792 / #797 — Human-readable guidance for a failure code attached to a
// payroll run during review. Pulls copy from the shared registry so the
// message, severity and remediation stay in step with the operator runbook
// and never include raw payload fields (salary, employee ids, ZK inputs).

interface PayrollReviewFailureGuidanceProps {
  code: string;
}

const SEVERITY_STYLE: Record<
  PayrollFailureCodeSeverity,
  { wrapper: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; heading: string; body: string }
> = {
  critical: {
    wrapper: "border-red-300 bg-red-50",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    heading: "text-red-900",
    body: "text-red-800",
  },
  error: {
    wrapper: "border-amber-300 bg-amber-50",
    icon: AlertCircle,
    iconColor: "text-amber-600",
    heading: "text-amber-900",
    body: "text-amber-800",
  },
  warning: {
    wrapper: "border-yellow-300 bg-yellow-50",
    icon: AlertTriangle,
    iconColor: "text-yellow-600",
    heading: "text-yellow-900",
    body: "text-yellow-800",
  },
};

export function PayrollReviewFailureGuidance({
  code,
}: PayrollReviewFailureGuidanceProps) {
  const guidance = getPayrollFailureGuidance(code);
  if (!guidance) return null;
  const style = SEVERITY_STYLE[guidance.severity];
  const Icon = style.icon;
  return (
    <section
      role="alert"
      data-testid="payroll-review-failure-guidance"
      aria-labelledby="payroll-review-failure-heading"
      className={`rounded-lg border ${style.wrapper} p-4`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2
            id="payroll-review-failure-heading"
            className={`text-sm font-semibold ${style.heading}`}
          >
            {guidance.title}
          </h2>
          <p className={`mt-1 text-sm ${style.body}`}>
            {guidance.userFacingMessage}
          </p>
          {guidance.remediation.length > 0 && (
            <ol className={`mt-2 list-decimal pl-5 text-sm ${style.body} space-y-1`}>
              {guidance.remediation.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-gray-500 font-mono">
            code: {guidance.code}
          </p>
        </div>
      </div>
    </section>
  );
}

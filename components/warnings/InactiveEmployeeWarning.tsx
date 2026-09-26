"use client";

import { useMemo } from "react";
import { AlertTriangle, ShieldAlert, UserX, EyeOff } from "lucide-react";
import type { Employee } from "@/types/models";
import {
  INELIGIBLE_REASON_LABELS,
  buildInactiveEmployeeWarning,
} from "@/src/payroll/inactiveEmployees";

export interface InactiveEmployeeWarningProps {
  /** Current employee roster used to resolve the draft entries. */
  employees: Employee[];
  /** Employee ids stored on the payroll draft or run. */
  employeeIds: string[];
  className?: string;
}

/**
 * Reviewer-facing warning for inactive or suspended employees left in a payroll
 * draft (issue #293). Renders nothing when every draft entry is eligible.
 *
 * PRIVACY: shows name, eligibility reason and employee id only — the fields a
 * reviewer needs to act. Salary, commitment and wallet data are never rendered.
 */
export function InactiveEmployeeWarning({
  employees,
  employeeIds,
  className = "",
}: InactiveEmployeeWarningProps) {
  const warning = useMemo(
    () => buildInactiveEmployeeWarning(employees, employeeIds),
    [employees, employeeIds],
  );

  if (!warning) return null;

  const isCritical = warning.severity === "critical";
  const HeadingIcon = isCritical ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="alert"
      aria-labelledby="inactive-employee-warning-heading"
      data-testid="inactive-employee-warning"
      data-severity={warning.severity}
      className={`rounded-lg border p-4 ${
        isCritical
          ? "border-red-200 border-l-4 border-l-red-500 bg-red-50"
          : "border-amber-200 border-l-4 border-l-amber-500 bg-amber-50"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <HeadingIcon
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            isCritical ? "text-red-600" : "text-amber-600"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              id="inactive-employee-warning-heading"
              className={`text-sm font-semibold ${
                isCritical ? "text-red-800" : "text-amber-800"
              }`}
            >
              {warning.title}
            </h4>
            <span
              data-testid="inactive-employee-count"
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                isCritical
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {warning.affectedEmployees.length} affected
            </span>
          </div>

          <p
            className={`mt-1 text-sm ${
              isCritical ? "text-red-700" : "text-amber-700"
            }`}
          >
            {warning.message}
          </p>

          <ul
            aria-label="Employees not eligible for this payroll"
            className="mt-3 space-y-1.5"
          >
            {warning.affectedEmployees.map((flag) => (
              <li
                key={flag.employeeId}
                data-testid={`ineligible-employee-${flag.employeeId}`}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <UserX
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isCritical ? "text-red-500" : "text-amber-600"
                  }`}
                  aria-hidden="true"
                />
                <span className="font-medium text-gray-900">{flag.name}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    isCritical
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {INELIGIBLE_REASON_LABELS[flag.reason]}
                </span>
                <span className="font-mono text-gray-400">
                  ID: {flag.employeeId}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-700">What to do</p>
            <ul
              data-testid="inactive-employee-next-steps"
              className="mt-1 list-disc space-y-1 pl-4 text-xs text-gray-600"
            >
              {warning.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
            <EyeOff className="h-3 w-3 shrink-0" aria-hidden="true" />
            Compensation values and wallet addresses stay private in this
            review — only employment status is shown.
          </p>
        </div>
      </div>
    </div>
  );
}

export default InactiveEmployeeWarning;

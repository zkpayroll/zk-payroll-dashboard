"use client";

import { CheckCircle2, ShieldAlert, Users } from "lucide-react";
import { evaluateEmployeeEligibilityStatus } from "@/lib/employees/employeeEligibilityStatus";
import type { Employee } from "@/types/models";

export interface DashboardEmployeeEligibilityStatusCheckProps {
  employees?: Employee[] | null;
  className?: string;
}

function toneClass(status: "valid" | "warning" | "invalid"): string {
  if (status === "valid") return "border-green-200 bg-green-50";
  return "border-amber-200 bg-amber-50";
}

function StatusIcon({ status }: { status: "valid" | "warning" | "invalid" }) {
  if (status === "valid") {
    return (
      <CheckCircle2
        className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
        aria-hidden="true"
      />
    );
  }
  return (
    <ShieldAlert
      className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
      aria-hidden="true"
    />
  );
}

// Fallback empty list or mock list
function buildDemoEmployees(): Employee[] {
  return [
    {
      id: "demo-1",
      address: "G...",
      name: "Demo Active",
      salary: 1000,
      salaryCommitment: "...",
      isActive: true,
      status: "active",
      onboardingStatus: "completed",
      startDate: new Date().toISOString(),
      lifecycleStatus: "active",
    } as Employee,
    {
      id: "demo-2",
      address: "G...",
      name: "Demo Inactive",
      salary: 1000,
      salaryCommitment: "...",
      isActive: false,
      status: "inactive",
      onboardingStatus: "completed",
      startDate: new Date().toISOString(),
      lifecycleStatus: "offboarded",
    } as Employee,
  ];
}

export default function DashboardEmployeeEligibilityStatusCheck({
  employees,
  className = "",
}: DashboardEmployeeEligibilityStatusCheckProps) {
  const resolvedEmployees = employees === undefined ? buildDemoEmployees() : (employees ?? []);

  const result = evaluateEmployeeEligibilityStatus(resolvedEmployees);
  const isValid = result.status === "valid";
  const tone = toneClass(result.status);

  const badge = isValid
    ? { label: "Ready", className: "bg-green-100 text-green-800" }
    : { label: "Notice", className: "bg-amber-100 text-amber-800" };

  return (
    <section
      role="status"
      aria-labelledby="dashboard-employee-eligibility-heading"
      className={`rounded-lg border p-4 transition-all ${tone} ${className}`}
      data-testid="dashboard-employee-eligibility"
      data-status={result.status}
      data-eligible-count={result.eligibleCount}
      data-ineligible-count={result.ineligibleCount}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={result.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-employee-eligibility-heading"
              className="text-sm font-semibold text-gray-900"
            >
              <Users
                className="mr-1.5 inline h-4 w-4 align-text-bottom"
                aria-hidden="true"
              />
              Employee eligibility status
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <p
            className={`mt-1 text-sm ${isValid ? "text-green-800" : "text-amber-800"}`}
            data-testid="dashboard-employee-eligibility-summary"
          >
            {result.summaryMessage}
          </p>

          {!isValid && (
            <div className="mt-3">
              <ul className="space-y-2 text-xs text-amber-800">
                {result.suspendedCount > 0 && (
                  <li>
                    • {result.suspendedCount} {result.suspendedCount === 1 ? "employee is" : "employees are"} suspended.
                  </li>
                )}
                {result.inactiveCount > 0 && (
                  <li>
                    • {result.inactiveCount} {result.inactiveCount === 1 ? "employee is" : "employees are"} inactive.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

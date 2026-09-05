"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Wallet,
  UserCheck,
  DollarSign,
  ShieldCheck,
  Users,
  ArrowRight,
} from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type {
  Employee,
  EmployeeOnboardingReadiness,
  EmployeeOnboardingStep,
  OnboardingStepStatus,
} from "@/types/models";

interface OnboardingReadinessTrackerProps {
  className?: string;
}

const STEP_LABELS: Record<string, string> = {
  wallet_connected: "Wallet Connected",
  identity_verified: "Identity Verified",
  salary_set: "Salary Configured",
  commitment_generated: "ZK Commitment",
  active_status: "Active Status",
};

function assessEmployeeReadiness(emp: Employee): EmployeeOnboardingReadiness {
  const steps: EmployeeOnboardingStep[] = [];

  // Step 1: Wallet Connected
  const hasValidAddress =
    emp.address && /^G[A-Z2-7]{54}$/.test(emp.address);
  steps.push({
    step: "wallet_connected",
    label: STEP_LABELS.wallet_connected,
    status: hasValidAddress ? "complete" : "pending",
  });

  // Step 2: Identity Verified (has email)
  const hasIdentity = !!emp.email;
  steps.push({
    step: "identity_verified",
    label: STEP_LABELS.identity_verified,
    status: hasIdentity ? "complete" : "pending",
  });

  // Step 3: Salary Set
  const hasSalary = emp.salary > 0;
  steps.push({
    step: "salary_set",
    label: STEP_LABELS.salary_set,
    status: hasSalary ? "complete" : "pending",
  });

  // Step 4: ZK Commitment Generated
  const hasCommitment =
    emp.salaryCommitment && emp.salaryCommitment.startsWith("0x");
  let commitmentStatus: OnboardingStepStatus = hasCommitment
    ? "complete"
    : "pending";
  if (emp.onboardingStatus === "in_progress" && !hasCommitment) {
    commitmentStatus = "in_progress";
  }
  if (emp.onboardingError && !hasCommitment) {
    commitmentStatus = "failed";
  }
  steps.push({
    step: "commitment_generated",
    label: STEP_LABELS.commitment_generated,
    status: commitmentStatus,
    error: emp.onboardingError || undefined,
  });

  // Step 5: Active Status
  const isActive = emp.isActive && emp.status !== "inactive";
  steps.push({
    step: "active_status",
    label: STEP_LABELS.active_status,
    status: isActive ? "complete" : "pending",
  });

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const totalCount = steps.length;
  const readyForPayroll = completedCount === totalCount;

  let overallStatus: EmployeeOnboardingReadiness["overallStatus"] = "not_ready";
  if (readyForPayroll) overallStatus = "ready";
  else if (completedCount >= totalCount / 2) overallStatus = "partial";

  return {
    employeeId: emp.id,
    name: emp.name,
    overallStatus,
    steps,
    readyForPayroll,
    completedCount,
    totalCount,
  };
}

function StatusIcon({ status }: { status: OnboardingStepStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case "in_progress":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300" />;
  }
}

function StepIcon({ step }: { step: string }) {
  switch (step) {
    case "wallet_connected":
      return <Wallet className="w-3.5 h-3.5" />;
    case "identity_verified":
      return <UserCheck className="w-3.5 h-3.5" />;
    case "salary_set":
      return <DollarSign className="w-3.5 h-3.5" />;
    case "commitment_generated":
      return <ShieldCheck className="w-3.5 h-3.5" />;
    case "active_status":
      return <Users className="w-3.5 h-3.5" />;
    default:
      return <Circle className="w-3.5 h-3.5" />;
  }
}

export default function OnboardingReadinessTracker({
  className = "",
}: OnboardingReadinessTrackerProps) {
  const { employees: storedEmployees } = useEmployeeStore();
  const employees =
    storedEmployees.length > 0 ? storedEmployees : MOCK_EMPLOYEES;

  const readinessData = useMemo(
    () => employees.map((emp) => assessEmployeeReadiness(emp)),
    [employees],
  );

  const readyCount = readinessData.filter(
    (r) => r.overallStatus === "ready",
  ).length;
  const partialCount = readinessData.filter(
    (r) => r.overallStatus === "partial",
  ).length;
  const notReadyCount = readinessData.filter(
    (r) => r.overallStatus === "not_ready",
  ).length;

  return (
    <section aria-labelledby="onboarding-readiness-heading" className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            id="onboarding-readiness-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Employee Onboarding Readiness
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track onboarding status for each employee before payroll execution
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            {readyCount} ready
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <Loader2 className="w-4 h-4" />
            {partialCount} partial
          </span>
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle className="w-4 h-4" />
            {notReadyCount} not ready
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(5,auto)] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600 uppercase tracking-wider">
          <div>Employee</div>
          <div className="text-center">Wallet</div>
          <div className="text-center">Identity</div>
          <div className="text-center">Salary</div>
          <div className="text-center">Commitment</div>
          <div className="text-center">Status</div>
        </div>

        {/* Rows */}
        <ul className="divide-y divide-gray-100">
          {readinessData.map((emp) => (
            <li
              key={emp.employeeId}
              className={`grid grid-cols-[1fr_repeat(5,auto)] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors ${
                emp.readyForPayroll ? "bg-emerald-50/30" : ""
              }`}
            >
              {/* Employee Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    emp.readyForPayroll
                      ? "bg-emerald-100 text-emerald-700"
                      : emp.overallStatus === "partial"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {emp.completedCount}/{emp.totalCount}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {emp.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {emp.readyForPayroll
                      ? "Ready for payroll"
                      : `${emp.totalCount - emp.completedCount} steps remaining`}
                  </p>
                </div>
              </div>

              {/* Steps */}
              {emp.steps.map((step) => (
                <div key={step.step} className="flex flex-col items-center gap-1">
                  <StatusIcon status={step.status} />
                  <div className="group relative">
                    <StepIcon step={step.step} />
                    {step.error && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Action */}
              <div>
                {emp.readyForPayroll ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready
                  </span>
                ) : (
                  <a
                    href="/employees"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Fix
                    <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

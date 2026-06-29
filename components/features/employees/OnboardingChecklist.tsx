"use client";

import { AlertTriangle, ArrowRight, UserPlus, FileSignature, Mail } from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";

interface OnboardingChecklistProps {
  onFixEmployee: (employeeId: string) => void;
}

export function OnboardingChecklist({ onFixEmployee }: OnboardingChecklistProps) {
  const { employees } = useEmployeeStore();

  const missingSteps = employees.map((emp) => {
    const missing = [];
    if (!emp.address || emp.address.trim() === "") {
      missing.push({
        id: "address",
        label: "Missing Wallet Address",
        icon: UserPlus,
      });
    }
    if (!emp.salaryCommitment || emp.salaryCommitment.trim() === "") {
      missing.push({
        id: "salaryCommitment",
        label: "Missing Salary Commitment",
        icon: FileSignature,
      });
    }
    if (!emp.department || emp.department.trim() === "" || !emp.email || emp.email.trim() === "") {
      missing.push({
        id: "profile",
        label: "Incomplete Profile (Email/Department)",
        icon: Mail,
      });
    }

    if (missing.length > 0) {
      return { employee: emp, missing };
    }
    return null;
  }).filter(Boolean) as Array<{
    employee: typeof employees[0];
    missing: Array<{ id: string; label: string; icon: any }>;
  }>;

  if (missingSteps.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-amber-200 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-900">
          Onboarding Attention Required ({missingSteps.length})
        </h3>
      </div>
      <div className="divide-y divide-amber-100/50">
        {missingSteps.map(({ employee, missing }) => (
          <div key={employee.id} className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-amber-100/30 transition-colors">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">{employee.name}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {missing.map((issue) => {
                  const Icon = issue.icon;
                  return (
                    <span
                      key={issue.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-amber-800 border border-amber-200 shadow-sm"
                    >
                      <Icon className="w-3 h-3" />
                      {issue.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFixEmployee(employee.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-md border border-amber-300 shadow-sm transition-all"
            >
              Fix Details
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

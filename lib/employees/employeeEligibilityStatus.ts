import type { Employee } from "@/types/models";
import { getIneligibilityReason } from "@/src/payroll/inactiveEmployees";

export interface EmployeeEligibilityStatusEvaluation {
  status: "valid" | "warning";
  eligibleCount: number;
  ineligibleCount: number;
  totalEmployees: number;
  summaryMessage: string;
  suspendedCount: number;
  inactiveCount: number;
}

export function evaluateEmployeeEligibilityStatus(
  employees: Employee[]
): EmployeeEligibilityStatusEvaluation {
  const evaluation: EmployeeEligibilityStatusEvaluation = {
    status: "valid",
    eligibleCount: 0,
    ineligibleCount: 0,
    totalEmployees: employees.length,
    summaryMessage: "",
    suspendedCount: 0,
    inactiveCount: 0,
  };

  for (const employee of employees) {
    const reason = getIneligibilityReason(employee);
    if (reason === "suspended") {
      evaluation.suspendedCount++;
      evaluation.ineligibleCount++;
    } else if (reason === "inactive") {
      evaluation.inactiveCount++;
      evaluation.ineligibleCount++;
    } else {
      evaluation.eligibleCount++;
    }
  }

  if (evaluation.ineligibleCount > 0) {
    evaluation.status = "warning";
    evaluation.summaryMessage = `${evaluation.ineligibleCount} of ${evaluation.totalEmployees} employees are ineligible for payroll.`;
  } else {
    if (evaluation.totalEmployees === 0) {
      evaluation.summaryMessage = "No employees found in the roster.";
    } else {
      evaluation.summaryMessage = "All employees are eligible for payroll.";
    }
  }

  return evaluation;
}

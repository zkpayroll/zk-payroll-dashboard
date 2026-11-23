import type { Employee } from "@/types/models";
import { getIneligibilityReason } from "@/src/payroll/inactiveEmployees";

/**
 * Employee payroll eligibility report (#267).
 *
 * Classifies every employee into a report state for the next payroll run and
 * supports admin filters (department, state, blocker type). Reasons are
 * privacy-safe: salary values are never included in row data or messages.
 */

export type PayrollEligibilityState =
  | "eligible"
  | "ineligible"
  | "pending"
  | "blocked";

export type EligibilityBlockerType =
  | "inactive"
  | "suspended"
  | "onboarding"
  | "lifecycle";

export interface EligibilityReportRow {
  employeeId: string;
  name: string;
  department: string;
  state: PayrollEligibilityState;
  blockerType?: EligibilityBlockerType;
  /** Privacy-safe explanation of the employee's state. */
  reason: string;
}

export interface EligibilityReportFilters {
  department?: string;
  state?: PayrollEligibilityState;
  blockerType?: EligibilityBlockerType;
}

export interface EmployeeEligibilityReport {
  rows: EligibilityReportRow[];
  counts: Record<PayrollEligibilityState, number>;
  totalEmployees: number;
  filteredCount: number;
  departments: string[];
  summaryMessage: string;
  /** True when the roster itself is empty (distinct from "filters removed everything"). */
  isEmptyRoster: boolean;
}

export const ELIGIBILITY_STATE_LABELS: Record<PayrollEligibilityState, string> = {
  eligible: "Eligible",
  ineligible: "Ineligible",
  pending: "Pending",
  blocked: "Blocked",
};

export const BLOCKER_TYPE_LABELS: Record<EligibilityBlockerType, string> = {
  inactive: "Inactive employment",
  suspended: "Suspended employment",
  onboarding: "Onboarding incomplete",
  lifecycle: "Lifecycle record blocked",
};

const UNASSIGNED_DEPARTMENT = "Unassigned";

const STATE_MESSAGES: Record<PayrollEligibilityState, string> = {
  eligible: "ready for the next payroll run",
  ineligible: "ineligible and must be removed or restored before submission",
  pending: "pending onboarding completion",
  blocked: "blocked by a lifecycle record issue",
};

export function classifyEmployeeEligibility(
  employee: Employee,
): Omit<EligibilityReportRow, "employeeId" | "name" | "department"> {
  const ineligibility = getIneligibilityReason(employee);
  if (ineligibility === "suspended") {
    return {
      state: "ineligible",
      blockerType: "suspended",
      reason: "Employee is suspended and cannot receive payroll.",
    };
  }
  if (ineligibility === "inactive") {
    return {
      state: "ineligible",
      blockerType: "inactive",
      reason: "Employee is inactive or offboarded and cannot receive payroll.",
    };
  }
  if (employee.onboardingStatus !== "completed") {
    return {
      state: "pending",
      blockerType: "onboarding",
      reason: `Onboarding is ${employee.onboardingStatus.replace("_", " ")} — complete onboarding before including this employee.`,
    };
  }
  if (employee.lifecycleStatus === "archived") {
    return {
      state: "blocked",
      blockerType: "lifecycle",
      reason: "Employee record is archived. Restore the record or exclude it from the draft.",
    };
  }
  return { state: "eligible", reason: "All eligibility checks pass." };
}

function toRow(employee: Employee): EligibilityReportRow {
  const classification = classifyEmployeeEligibility(employee);
  return {
    employeeId: employee.id,
    name: employee.name || "Unnamed employee",
    department: employee.department?.trim() || UNASSIGNED_DEPARTMENT,
    ...classification,
  };
}

function emptyCounts(): Record<PayrollEligibilityState, number> {
  return { eligible: 0, ineligible: 0, pending: 0, blocked: 0 };
}

export function buildEmployeeEligibilityReport(
  employees: Employee[],
  filters: EligibilityReportFilters = {},
): EmployeeEligibilityReport {
  const allRows = employees.map(toRow);

  const counts = emptyCounts();
  for (const row of allRows) counts[row.state]++;

  const departments = Array.from(new Set(allRows.map((r) => r.department))).sort();

  const rows = allRows.filter((row) => {
    if (filters.department && row.department !== filters.department) return false;
    if (filters.state && row.state !== filters.state) return false;
    if (filters.blockerType && row.blockerType !== filters.blockerType) return false;
    return true;
  });

  const isEmptyRoster = allRows.length === 0;

  let summaryMessage: string;
  if (isEmptyRoster) {
    summaryMessage = "No employees found in the roster.";
  } else if (rows.length === 0) {
    summaryMessage =
      "No employees match the current filters. Adjust or clear filters to see the full roster.";
  } else if (rows.length === allRows.length) {
    const parts = (Object.keys(counts) as PayrollEligibilityState[])
      .filter((state) => counts[state] > 0)
      .map((state) => `${counts[state]} ${STATE_MESSAGES[state]}`);
    summaryMessage = `${allRows.length} employee${allRows.length === 1 ? "" : "s"} in report: ${parts.join("; ")}.`;
  } else {
    summaryMessage = `${rows.length} of ${allRows.length} employees match the current filters.`;
  }

  return {
    rows,
    counts,
    totalEmployees: allRows.length,
    filteredCount: rows.length,
    departments,
    summaryMessage,
    isEmptyRoster,
  };
}

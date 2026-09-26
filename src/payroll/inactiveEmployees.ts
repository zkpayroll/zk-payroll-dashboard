import type { Employee } from "@/types/models";
import { deriveLifecycleStatus } from "@/src/lib/employees/lifecycleValidation";

/**
 * Draft-time eligibility rules for payroll (issue #293).
 *
 * A payroll draft stores only `employeeIds`, so a record that was suspended or
 * made inactive after the draft was assembled stays in the draft. These helpers
 * re-resolve each draft entry against the current employee roster so reviewers
 * can see — and act on — the stale entries before signing.
 *
 * PRIVACY: flags carry the employee id, display name and eligibility reason
 * only. Salary, salary commitment, wallet address and any other amount or
 * credential field is never read or copied into a warning, message, log or
 * telemetry event.
 */

export type IneligibleReason = "inactive" | "suspended" | "missing_record";

/** One draft entry that should not be paid as-is. */
export interface IneligibleEmployeeFlag {
  employeeId: string;
  name: string;
  reason: IneligibleReason;
}

export interface InactiveEmployeeWarning {
  id: "inactive-employee";
  severity: "warning" | "critical";
  title: string;
  message: string;
  affectedEmployees: IneligibleEmployeeFlag[];
  nextSteps: string[];
}

/** Stable identifier for the draft warning, safe to key UI and tests on. */
export const INACTIVE_EMPLOYEE_WARNING_ID = "inactive-employee";

const UNRESOLVED_EMPLOYEE_NAME = "Unresolved employee record";

export const INELIGIBLE_REASON_LABELS: Record<IneligibleReason, string> = {
  inactive: "Inactive",
  suspended: "Suspended",
  missing_record: "No longer in the employee roster",
};

const NEXT_STEPS = [
  "Remove these employees from the payroll draft before signing.",
  "Or restore their employment status on the employee lifecycle screen if the exclusion is incorrect.",
];

/**
 * Reason the employee must not be paid right now, or `null` when eligible.
 *
 * Offboarded and legacy-inactive records both report as `"inactive"`: the
 * lifecycle store collapses them onto `status: "inactive"`, and the distinction
 * does not change what a reviewer must do.
 */
export function getIneligibilityReason(
  employee: Employee,
): IneligibleReason | null {
  const lifecycle = deriveLifecycleStatus(employee);
  if (lifecycle === "suspended") return "suspended";
  if (
    lifecycle === "offboarded" ||
    employee.isActive === false ||
    employee.status === "inactive"
  ) {
    return "inactive";
  }
  return null;
}

/**
 * Resolve `employeeIds` against `employees` and return the ineligible entries
 * in draft order. Ids with no matching record are reported as `missing_record`
 * — that is exactly the stale-draft case this warning exists to catch.
 */
export function findIneligibleEmployees(
  employees: Employee[],
  employeeIds: string[],
): IneligibleEmployeeFlag[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const seen = new Set<string>();
  const flags: IneligibleEmployeeFlag[] = [];

  for (const employeeId of employeeIds) {
    if (seen.has(employeeId)) continue;
    seen.add(employeeId);

    const employee = byId.get(employeeId);
    if (!employee) {
      flags.push({
        employeeId,
        name: UNRESOLVED_EMPLOYEE_NAME,
        reason: "missing_record",
      });
      continue;
    }

    const reason = getIneligibilityReason(employee);
    if (reason) {
      flags.push({ employeeId: employee.id, name: employee.name, reason });
    }
  }

  return flags;
}

/** One-line, privacy-safe summary such as `Amara Diallo (Inactive)`. */
export function formatIneligibleEmployees(
  flags: IneligibleEmployeeFlag[],
): string {
  return flags
    .map((flag) => `${flag.name} (${INELIGIBLE_REASON_LABELS[flag.reason]})`)
    .join(", ");
}

/**
 * Reviewer-facing warning for a draft, or `null` when every entry is eligible.
 * Missing roster records are surfaced as `critical` because the draft would pay
 * an address that can no longer be verified; a suspended or inactive employee
 * is a `warning` the reviewer can resolve either way.
 */
export function buildInactiveEmployeeWarning(
  employees: Employee[],
  employeeIds: string[],
): InactiveEmployeeWarning | null {
  const affectedEmployees = findIneligibleEmployees(employees, employeeIds);
  if (affectedEmployees.length === 0) return null;

  const hasMissingRecord = affectedEmployees.some(
    (flag) => flag.reason === "missing_record",
  );
  const employeeWord = affectedEmployees.length === 1 ? "employee" : "employees";

  return {
    id: INACTIVE_EMPLOYEE_WARNING_ID,
    severity: hasMissingRecord ? "critical" : "warning",
    title: hasMissingRecord
      ? "Payroll draft references unavailable employee records"
      : "Inactive or suspended employees in this payroll",
    message: `${affectedEmployees.length} ${employeeWord} in this payroll draft ${
      affectedEmployees.length === 1 ? "is" : "are"
    } not eligible for payment: ${formatIneligibleEmployees(affectedEmployees)}.`,
    affectedEmployees,
    nextSteps: NEXT_STEPS,
  };
}

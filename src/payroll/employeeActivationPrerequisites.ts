import type { Employee, UserRole } from "@/types";
import { deriveLifecycleStatus } from "@/src/lib/employees/lifecycleValidation";

/**
 * Dashboard employee activation prerequisite checks (issue #627).
 *
 * Activating an employee makes them payroll-eligible again, so it must not
 * succeed until every prerequisite holds. These helpers validate one employee
 * record (or a batch of draft ids) against the prerequisite list before a
 * lifecycle store transition runs, and return structured, actionable errors
 * instead of throwing.
 *
 * PRIVACY: findings carry the employee id, display name, and lifecycle /
 * onboarding state only. Salary, salary commitment, wallet address, and any
 * other amount or credential field are never read into an error message,
 * log, or telemetry event.
 */

export type ActivationPrerequisiteCode =
  /** The activation actor is not an administrator. */
  | "unauthorized"
  /** The id refers to no employee record in the roster. */
  | "missing_record"
  /** The employee's lifecycle state does not permit activation. */
  | "invalid_lifecycle_state"
  /** Onboarding has not been completed for this employee. */
  | "onboarding_not_completed";

export interface ActivationPrerequisiteError {
  code: ActivationPrerequisiteCode;
  message: string;
}

/** One draft/system entry that cannot be activated as-is. */
export interface BlockedActivationEntry {
  employeeId: string;
  name: string;
  code: ActivationPrerequisiteCode;
}

export interface ActivationEntryCheck {
  employeeId: string;
  name: string;
  ok: boolean;
  error: ActivationPrerequisiteError | null;
}

export interface BatchActivationPrerequisiteSummary {
  readyCount: number;
  blockedCount: number;
  canProceed: boolean;
  checks: ActivationEntryCheck[];
  blockerMessage: string | null;
}

const UNRESOLVED_EMPLOYEE_NAME = "Unresolved employee record";

const ACTIVATION_PREREQUISITE_CODES: Record<ActivationPrerequisiteCode, string> = {
  unauthorized: "Not authorized",
  missing_record: "No longer in the employee roster",
  invalid_lifecycle_state: "Not in an activatable state",
  onboarding_not_completed: "Onboarding not completed",
};

function lifecycleStateMessage(status: string): string {
  if (status === "active") {
    return "This employee is already active.";
  }
  return `Activation is only available for suspended employees. This employee is currently ${status}.`;
}

function onboardingMessage(onboardingStatus: Employee["onboardingStatus"]): string {
  if (onboardingStatus === "in_progress") {
    return "Employee onboarding is still in progress. Complete onboarding before activating.";
  }
  return "Employee onboarding has not been completed. Complete onboarding before activating.";
}

/**
 * Reason this employee cannot be activated right now, or `null` when every
 * prerequisite holds for `role`.
 *
 * Prerequisites, in order:
 * 1. The actor holds the `admin` role (lifecycle actions are admin-only).
 * 2. The employee resolves to an existing record (checked by the id first).
 * 3. The employee is `suspended` — the only state that permits activation
 *    (mirrors `ALLOWED_TRANSITIONS` in `lifecycleValidation`).
 * 4. Onboarding has completed; in-progress or not-started onboarding blocks
 *    payroll eligibility just as it blocks offboarding.
 */
export function evaluateActivationPrerequisites(
  employee: Employee,
  role: UserRole,
): ActivationPrerequisiteError | null {
  if (role !== "admin") {
    return {
      code: "unauthorized",
      message: "Only administrators can activate employees.",
    };
  }

  const status = deriveLifecycleStatus(employee);
  if (status !== "suspended") {
    return {
      code: "invalid_lifecycle_state",
      message: lifecycleStateMessage(status),
    };
  }

  if (employee.onboardingStatus !== "completed") {
    return {
      code: "onboarding_not_completed",
      message: onboardingMessage(employee.onboardingStatus),
    };
  }

  return null;
}

/**
 * Resolve `employeeIds` against the roster and collect every activation
 * blocker in input order. Ids with no matching record surface as
 * `missing_record`; duplicate ids are reported once.
 */
export function findBlockedActivationEntries(
  employees: Employee[],
  employeeIds: string[],
  role: UserRole,
): BlockedActivationEntry[] {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const seen = new Set<string>();
  const blocked: BlockedActivationEntry[] = [];

  for (const employeeId of employeeIds) {
    if (seen.has(employeeId)) continue;
    seen.add(employeeId);

    const employee = byId.get(employeeId);
    if (!employee) {
      blocked.push({
        employeeId,
        name: UNRESOLVED_EMPLOYEE_NAME,
        code: "missing_record",
      });
      continue;
    }

    const error = evaluateActivationPrerequisites(employee, role);
    if (error) {
      blocked.push({ employeeId: employee.id, name: employee.name, code: error.code });
    }
  }

  return blocked;
}

/** One-line, privacy-safe list such as `Kwame Asante (Onboarding not completed)`. */
export function formatBlockedActivationEntries(entries: BlockedActivationEntry[]): string {
  return entries
    .map((entry) => `${entry.name} (${ACTIVATION_PREREQUISITE_CODES[entry.code]})`)
    .join(", ");
}

/**
 * Validate a batch of activation candidates and return whether payroll-facing
 * activation may proceed. `canProceed` is true only when every id resolves to
 * a suspended, fully onboarded employee and the role is admin.
 */
export function validateActivationPrerequisiteBatch(
  employees: Employee[],
  employeeIds: string[],
  role: UserRole,
): BatchActivationPrerequisiteSummary {
  if (role !== "admin") {
    return {
      readyCount: 0,
      blockedCount: employeeIds.length,
      canProceed: false,
      checks: [],
      blockerMessage:
        "Only administrators can activate employees. Ask an administrator to run this activation.",
    };
  }

  if (employeeIds.length === 0) {
    return {
      readyCount: 0,
      blockedCount: 0,
      canProceed: false,
      checks: [],
      blockerMessage: "No employees selected — nothing to activate.",
    };
  }

  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const checks: ActivationEntryCheck[] = employeeIds.map((employeeId) => {
    const employee = byId.get(employeeId);
    const name = employee?.name ?? UNRESOLVED_EMPLOYEE_NAME;
    if (!employee) {
      return {
        employeeId,
        name,
        ok: false,
        error: {
          code: "missing_record" as const,
          message: "No employee record matches this id. Remove it from the activation list.",
        },
      };
    }
    const error = evaluateActivationPrerequisites(employee, role);
    return {
      employeeId: employee.id,
      name,
      ok: error === null,
      error,
    };
  });

  const blocked = checks.filter((check) => !check.ok);
  const canProceed = blocked.length === 0;

  return {
    readyCount: checks.length - blocked.length,
    blockedCount: blocked.length,
    canProceed,
    checks,
    blockerMessage: canProceed
      ? null
      : `${blocked.length} activation ${blocked.length === 1 ? "entry" : "entries"} cannot proceed: ${formatBlockedActivationEntries(
          blocked.map((check) => ({
            employeeId: check.employeeId,
            name: check.name,
            code: check.error!.code,
          })),
        )}. Fix the listed prerequisites before activating.`,
  };
}


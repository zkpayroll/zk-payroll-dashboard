import type { Employee, EmployeeLifecycleStatus, UserRole } from "@/types";

/**
 * Lifecycle transition rules. Only admins can perform lifecycle actions.
 * Suspended employees can be reactivated or offboarded.
 * Offboarded employees cannot be reactivated (must be re-onboarded).
 */

export type LifecycleAction = "activate" | "suspend" | "offboard";

export interface LifecycleTransitionError {
  code: string;
  message: string;
}

const ALLOWED_TRANSITIONS: Record<EmployeeLifecycleStatus, LifecycleAction[]> = {
  active: ["suspend", "offboard"],
  suspended: ["activate", "offboard"],
  offboarded: [],
};

/**
 * Derive the effective lifecycle status from the Employee model.
 * Falls back to `isActive` when `lifecycleStatus` is not yet set.
 */
export function deriveLifecycleStatus(employee: Employee): EmployeeLifecycleStatus {
  if (employee.lifecycleStatus) return employee.lifecycleStatus;
  return employee.isActive ? "active" : "offboarded";
}

/**
 * Validate whether `action` is allowed for the given employee and role.
 * Returns `null` when valid, or a structured error otherwise.
 * Error messages never expose salary or commitment data.
 */
export function validateLifecycleTransition(
  employee: Employee,
  action: LifecycleAction,
  role: UserRole,
): LifecycleTransitionError | null {
  if (role !== "admin") {
    return {
      code: "UNAUTHORIZED",
      message: "Only administrators can manage employee lifecycle status.",
    };
  }

  const currentStatus = deriveLifecycleStatus(employee);
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed.includes(action)) {
    return {
      code: "INVALID_TRANSITION",
      message: `Cannot ${action} an employee who is currently ${currentStatus}.`,
    };
  }

  if (action === "offboard" && employee.onboardingStatus === "in_progress") {
    return {
      code: "ONBOARDING_IN_PROGRESS",
      message: "Cannot offboard an employee while onboarding is in progress.",
    };
  }

  return null;
}

/**
 * Return the list of actions available for the given employee and role.
 */
export function availableLifecycleActions(
  employee: Employee,
  role: UserRole,
): LifecycleAction[] {
  if (role !== "admin") return [];
  const currentStatus = deriveLifecycleStatus(employee);
  return ALLOWED_TRANSITIONS[currentStatus];
}

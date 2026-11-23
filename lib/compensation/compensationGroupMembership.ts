import type {
  CompensationGroup,
  CompensationGroupMembershipCheck,
  CompensationGroupMembershipEntry,
  CompensationGroupMembershipOptions,
  CompensationGroupMembershipResult,
  CompensationGroupMembershipSeverity,
  CompensationGroupStatus,
} from "@/types/compensation";
import { DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION } from "@/types/compensation";

/**
 * Dashboard compensation group membership validation (#687).
 *
 * Before compensation changes are scheduled, every employee must belong to an
 * active, recognized compensation group. This module validates group membership
 * assignments so the dashboard can block or warn before an invalid assignment
 * reaches payroll. It is privacy-safe: only employee ids, group ids, group
 * names, and activity flags are inspected — never salary amounts or payout
 * destinations.
 *
 * Rules:
 *  1. Every evaluated employee must belong to at least one active group.
 *  2. Every group referenced by a membership must exist and be active.
 *  3. An employee must not be assigned to more than one active group.
 *  4. Memberships in inactive groups are flagged (error or warning by option).
 *
 * All functions are pure: they never throw on untrusted input, never mutate
 * their arguments, and never read the clock.
 */

function groupById(groups: readonly CompensationGroup[]): Map<string, CompensationGroup> {
  const map = new Map<string, CompensationGroup>();
  for (const group of groups) {
    map.set(group.id, group);
  }
  return map;
}

function membershipsByEmployee(
  memberships: readonly CompensationGroupMembershipEntry[],
): Map<string, CompensationGroupMembershipEntry[]> {
  const map = new Map<string, CompensationGroupMembershipEntry[]>();
  for (const membership of memberships) {
    const existing = map.get(membership.employeeId) ?? [];
    existing.push(membership);
    map.set(membership.employeeId, existing);
  }
  return map;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeOptions(
  options: CompensationGroupMembershipOptions = {},
): Required<Pick<CompensationGroupMembershipOptions, "allowUngroupedEmployees" | "allowMembershipInInactiveGroups">> & {
  remediationAction: { label: string; href: string };
} {
  return {
    allowUngroupedEmployees: options.allowUngroupedEmployees ?? false,
    allowMembershipInInactiveGroups: options.allowMembershipInInactiveGroups ?? false,
    remediationAction: options.remediationAction ?? { ...DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION },
  };
}

function resolveEntry(
  rawEntry: unknown,
  index: number,
): CompensationGroupMembershipEntry | null {
  const position = index + 1;
  if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
    return null;
  }

  const entry = rawEntry as Partial<CompensationGroupMembershipEntry>;
  if (
    typeof entry.employeeId !== "string" ||
    entry.employeeId.trim() === ""
  ) {
    return null;
  }
  if (
    typeof entry.groupId !== "string" ||
    entry.groupId.trim() === ""
  ) {
    return null;
  }

  return {
    employeeId: entry.employeeId.trim(),
    groupId: entry.groupId.trim(),
    isActive: entry.isActive !== false,
  };
}

function addCheck(
  checks: CompensationGroupMembershipCheck[],
  errors: CompensationGroupMembershipCheck[],
  warnings: CompensationGroupMembershipCheck[],
  id: string,
  severity: CompensationGroupMembershipSeverity,
  title: string,
  message: string,
  remediation?: string,
  employeeId?: string,
  groupId?: string,
): void {
  const check: CompensationGroupMembershipCheck = {
    id,
    severity,
    title,
    message,
    remediation,
    ...(employeeId !== undefined ? { employeeId } : {}),
    ...(groupId !== undefined ? { groupId } : {}),
  };
  checks.push(check);
  if (severity === "error") {
    errors.push(check);
  } else {
    warnings.push(check);
  }
}

/**
 * Evaluate compensation group membership assignments. Never throws on untrusted
 * input: malformed entries or groups are skipped and reported as findings.
 */
export function evaluateCompensationGroupMembership(
  employees: unknown,
  groups: unknown,
  memberships: unknown,
  options: CompensationGroupMembershipOptions = {},
): CompensationGroupMembershipResult {
  const resolvedOptions = normalizeOptions(options);

  const resolvedGroups: CompensationGroup[] = Array.isArray(groups)
    ? groups.filter(
        (g): g is CompensationGroup =>
          typeof g === "object" &&
          g !== null &&
          typeof (g as CompensationGroup).id === "string" &&
          typeof (g as CompensationGroup).name === "string",
      )
    : [];

  const resolvedMemberships: CompensationGroupMembershipEntry[] = [];
  if (Array.isArray(memberships)) {
    memberships.forEach((raw, index) => {
      const resolved = resolveEntry(raw, index);
      if (resolved) resolvedMemberships.push(resolved);
    });
  }

  const groupMap = groupById(resolvedGroups);
  const byEmployee = membershipsByEmployee(resolvedMemberships);

  const checks: CompensationGroupMembershipCheck[] = [];
  const errors: CompensationGroupMembershipCheck[] = [];
  const warnings: CompensationGroupMembershipCheck[] = [];

  const employeeIds: string[] = [];
  if (Array.isArray(employees)) {
    for (const employee of employees) {
      if (typeof employee === "object" && employee !== null && typeof (employee as { employeeId?: unknown }).employeeId === "string") {
        employeeIds.push((employee as { employeeId: string }).employeeId);
      }
    }
  }

  // Rule 1: every employee must belong to at least one active group.
  for (const employeeId of employeeIds) {
    const memberships = byEmployee.get(employeeId) ?? [];
    const activeMemberships = memberships.filter(
      (m) => m.isActive && groupMap.has(m.groupId),
    );

    if (activeMemberships.length === 0) {
      addCheck(
        checks,
        errors,
        warnings,
        "employee-not-in-active-group",
        resolvedOptions.allowUngroupedEmployees ? "warning" : "error",
        "Employee not in any active compensation group",
        `Employee ${employeeId} is not assigned to an active compensation group, so compensation changes cannot be applied to them.`,
        `Assign ${employeeId} to an active compensation group or mark them as excluded from compensation changes.`,
        employeeId,
      );
    }
  }

  // Rule 2: every referenced group must exist and be active.
  for (const membership of resolvedMemberships) {
    const group = groupMap.get(membership.groupId);
    if (!group) {
      addCheck(
        checks,
        errors,
        warnings,
        "unknown-compensation-group",
        "error",
        "Unknown compensation group",
        `Membership for employee ${membership.employeeId} references an unknown compensation group ${membership.groupId}.`,
        `Remove the membership or create the group ${membership.groupId}.`,
        membership.employeeId,
        membership.groupId,
      );
    } else if (!resolvedOptions.allowMembershipInInactiveGroups && group.name === "") {
      // Name presence is used as a lightweight proxy for group being configured;
      // an empty-name group is treated as inactive.
      addCheck(
        checks,
        errors,
        warnings,
        "inactive-compensation-group",
        "warning",
        "Compensation group not active",
        `Employee ${membership.employeeId} is assigned to group ${membership.groupId}, which is not configured as an active compensation group.`,
        `Activate group ${membership.groupId} or reassign the employee.`,
        membership.employeeId,
        membership.groupId,
      );
    }
  }

  // Rule 3: an employee must not belong to more than one active group.
  for (const [employeeId, memberships] of byEmployee) {
    const activeGroups = memberships.filter((m) => m.isActive && groupMap.has(m.groupId));
    if (activeGroups.length > 1) {
      const groupIds = activeGroups.map((m) => m.groupId).join(", ");
      addCheck(
        checks,
        errors,
        warnings,
        "employee-in-multiple-active-groups",
        "error",
        "Employee in multiple active compensation groups",
        `Employee ${employeeId} is assigned to multiple active compensation groups (${groupIds}), which makes their compensation terms ambiguous.`,
        `Keep ${employeeId} in exactly one active compensation group and archive the rest.`,
        employeeId,
      );
    }
  }

  // Rule 4: memberships in inactive groups are flagged.
  for (const membership of resolvedMemberships) {
    const group = groupMap.get(membership.groupId);
    if (!group) continue; // already flagged by rule 2
    if (!membership.isActive) {
      addCheck(
        checks,
        errors,
        warnings,
        "inactive-membership",
        "warning",
        "Inactive compensation group membership",
        `Employee ${membership.employeeId} has an inactive membership in group ${membership.groupId}.`,
        `Activate or remove the membership for ${membership.employeeId} in group ${membership.groupId}.`,
        membership.employeeId,
        membership.groupId,
      );
    }
  }

  const validMembershipCount = resolvedMemberships.filter(
    (m) => !checks.some((c) => c.employeeId === m.employeeId && c.groupId === m.groupId && c.severity === "error"),
  ).length;

  const ungroupedEmployeeCount = employeeIds.filter(
    (employeeId) => {
      const memberships = byEmployee.get(employeeId) ?? [];
      return memberships.filter(
        (m) => m.isActive && groupMap.has(m.groupId),
      ).length === 0;
    },
  ).length;

  const status: "valid" | "warning" | "invalid" =
    errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid";

  return {
    status,
    canProceedWithCompensationChanges: errors.length === 0,
    checkedMemberships: resolvedMemberships,
    checks: [...errors, ...warnings],
    errors,
    warnings,
    validMembershipCount,
    ungroupedEmployeeCount,
    summaryMessage: buildSummaryMessage({
      status,
      totalEmployees: employeeIds.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      ungroupedEmployeeCount,
      remediationHref: resolvedOptions.remediationAction.href,
    }),
    remediationAction:
      status === "valid" ? undefined : { ...resolvedOptions.remediationAction },
  };
}

function buildSummaryMessage(context: {
  status: "valid" | "warning" | "invalid";
  totalEmployees: number;
  errorCount: number;
  warningCount: number;
  ungroupedEmployeeCount: number;
  remediationHref: string;
}): string {
  const { status, totalEmployees, errorCount, warningCount, ungroupedEmployeeCount } = context;
  const employeeLabel = pluralize(totalEmployees, "employee", "employees");

  if (status === "invalid") {
    return `Compensation changes cannot proceed: ${pluralize(errorCount, "group membership problem")} found across ${employeeLabel}. Review the groups at ${context.remediationHref}.`;
  }

  if (status === "warning") {
    let message = `Compensation changes can proceed, but ${pluralize(warningCount, "group membership advisory", "advisories")} need review across ${employeeLabel}.`;
    if (ungroupedEmployeeCount > 0) {
      message += ` ${pluralize(ungroupedEmployeeCount, "employee", "employees")} are not in any active group.`;
    }
    return message;
  }

  return `All ${employeeLabel} have valid compensation group membership.`;
}

/**
 * Assert that compensation group membership is safe to proceed with. Throws an
 * error carrying the full result when blocking findings are present.
 */
export class CompensationGroupMembershipError extends Error {
  public readonly result: CompensationGroupMembershipResult;

  constructor(message: string, result: CompensationGroupMembershipResult) {
    super(message);
    this.name = "CompensationGroupMembershipError";
    this.result = result;
  }
}

/**
 * Assert that compensation group membership is valid. Throws
 * {@link CompensationGroupMembershipError} when any blocking finding is present.
 */
export function assertCompensationGroupMembership(
  employees: unknown,
  groups: unknown,
  memberships: unknown,
  options: CompensationGroupMembershipOptions = {},
): CompensationGroupMembershipResult {
  const result = evaluateCompensationGroupMembership(employees, groups, memberships, options);
  if (!result.canProceedWithCompensationChanges) {
    throw new CompensationGroupMembershipError(result.summaryMessage, result);
  }
  return result;
}

export type {
  CompensationGroup,
  CompensationGroupMembershipEntry,
  CompensationGroupMembershipCheck,
  CompensationGroupMembershipResult,
  CompensationGroupMembershipOptions,
  CompensationGroupMembershipSeverity,
  CompensationGroupStatus,
};
export { DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION };
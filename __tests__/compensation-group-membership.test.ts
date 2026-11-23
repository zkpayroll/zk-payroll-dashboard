import { describe, expect, it } from "vitest";
import {
  CompensationGroupMembershipError,
  assertCompensationGroupMembership,
  evaluateCompensationGroupMembership,
  DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION,
} from "@/src/payroll/compensationGroupMembership";

describe("evaluateCompensationGroupMembership", () => {
  const groups = [
    { id: "group_eng", name: "Engineering", employeeIds: ["emp_001", "emp_002"] },
    { id: "group_sales", name: "Sales", employeeIds: ["emp_003"] },
  ];

  const memberships = [
    { employeeId: "emp_001", groupId: "group_eng", isActive: true },
    { employeeId: "emp_002", groupId: "group_eng", isActive: true },
    { employeeId: "emp_003", groupId: "group_sales", isActive: true },
  ];

  const employees = [
    { employeeId: "emp_001" },
    { employeeId: "emp_002" },
    { employeeId: "emp_003" },
  ];

  it("returns valid when every employee is in exactly one active group", () => {
    const result = evaluateCompensationGroupMembership(
      employees,
      groups,
      memberships,
    );

    expect(result.status).toBe("valid");
    expect(result.canProceedWithCompensationChanges).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validMembershipCount).toBe(3);
    expect(result.ungroupedEmployeeCount).toBe(0);
  });

  it("flags an employee not in any active group", () => {
    const result = evaluateCompensationGroupMembership(
      [...employees, { employeeId: "emp_004" }],
      groups,
      memberships,
    );

    expect(result.status).toBe("invalid");
    expect(result.canProceedWithCompensationChanges).toBe(false);
    expect(result.ungroupedEmployeeCount).toBe(1);
    expect(result.errors.some((e) => e.id === "employee-not-in-active-group")).toBe(true);
    expect(result.errors.some((e) => e.employeeId === "emp_004")).toBe(true);
  });

  it("treats ungrouped employees as a warning when allowed", () => {
    const result = evaluateCompensationGroupMembership(
      [...employees, { employeeId: "emp_004" }],
      groups,
      memberships,
      { allowUngroupedEmployees: true },
    );

    expect(result.status).toBe("warning");
    expect(result.canProceedWithCompensationChanges).toBe(true);
    const warning = result.warnings.find((w) => w.id === "employee-not-in-active-group");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("flags an unknown group referenced by a membership", () => {
    const badMemberships = [
      ...memberships,
      { employeeId: "emp_001", groupId: "group_unknown", isActive: true },
    ];
    const result = evaluateCompensationGroupMembership(
      employees,
      groups,
      badMemberships,
    );

    expect(result.status).toBe("invalid");
    expect(result.errors.some((e) => e.id === "unknown-compensation-group")).toBe(true);
  });

  it("flags an employee in multiple active groups", () => {
    const multiMemberships = [
      { employeeId: "emp_001", groupId: "group_eng", isActive: true },
      { employeeId: "emp_001", groupId: "group_sales", isActive: true },
      { employeeId: "emp_003", groupId: "group_sales", isActive: true },
    ];
    const result = evaluateCompensationGroupMembership(
      employees,
      groups,
      multiMemberships,
    );

    expect(result.status).toBe("invalid");
    expect(result.errors.some((e) => e.id === "employee-in-multiple-active-groups")).toBe(true);
    expect(result.errors.some((e) => e.employeeId === "emp_001")).toBe(true);
  });

  it("flags inactive memberships as warnings", () => {
    const inactiveMemberships = [
      { employeeId: "emp_001", groupId: "group_eng", isActive: false },
      { employeeId: "emp_003", groupId: "group_sales", isActive: true },
    ];
    const result = evaluateCompensationGroupMembership(
      employees,
      groups,
      inactiveMemberships,
    );

    expect(result.status).toBe("invalid"); // emp_002 is ungrouped, which is an error by default
    expect(result.warnings.some((w) => w.id === "inactive-membership")).toBe(true);
  });

  it("handles malformed inputs gracefully", () => {
    const result = evaluateCompensationGroupMembership(null, null, null);

    expect(result.status).toBe("valid");
    expect(result.canProceedWithCompensationChanges).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION", () => {
  it("points to the compensation groups settings page", () => {
    expect(DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION.label).toBe("Review compensation groups");
    expect(DEFAULT_COMPENSATION_GROUP_REMEDIATION_ACTION.href).toBe("/settings/compensation-groups");
  });
});

describe("assertCompensationGroupMembership", () => {
  const groups = [{ id: "group_eng", name: "Engineering", employeeIds: ["emp_001"] }];
  const memberships = [{ employeeId: "emp_001", groupId: "group_eng", isActive: true }];
  const employees = [{ employeeId: "emp_001" }];

  it("returns the result when membership is valid", () => {
    const result = assertCompensationGroupMembership(employees, groups, memberships);

    expect(result.status).toBe("valid");
    expect(result.canProceedWithCompensationChanges).toBe(true);
  });

  it("throws a typed error carrying the result when invalid", () => {
    let thrown: unknown;
    try {
      assertCompensationGroupMembership(
        [{ employeeId: "emp_002" }],
        groups,
        memberships,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CompensationGroupMembershipError);
    const error = thrown as CompensationGroupMembershipError;
    expect(error.name).toBe("CompensationGroupMembershipError");
    expect(error.result.status).toBe("invalid");
    expect(error.message).toContain("cannot proceed");
  });
});
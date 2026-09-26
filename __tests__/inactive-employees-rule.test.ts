import { describe, it, expect } from "vitest";
import type { Employee } from "@/types/models";
import {
  buildInactiveEmployeeWarning,
  findIneligibleEmployees,
  formatIneligibleEmployees,
  getIneligibilityReason,
} from "@/src/payroll/inactiveEmployees";

function makeEmployee(overrides: Partial<Employee> & { id: string }): Employee {
  return {
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    name: `Employee ${overrides.id}`,
    salary: 5000,
    salaryCommitment: "0xabc123def456",
    isActive: true,
    status: "active",
    onboardingStatus: "completed",
    startDate: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

const active = makeEmployee({ id: "emp_001", name: "Alice Mensah" });
const legacyInactive = makeEmployee({
  id: "emp_003",
  name: "Amara Diallo",
  isActive: false,
  status: "inactive",
});
const suspended = makeEmployee({
  id: "emp_004",
  name: "Kofi Boateng",
  lifecycleStatus: "suspended",
  // The lifecycle store keeps isActive true while a suspension is temporary.
  suspendedAt: "2026-09-01T00:00:00Z",
});
const offboarded = makeEmployee({
  id: "emp_005",
  name: "Yaa Asantewaa",
  lifecycleStatus: "offboarded",
});
const pendingOnboarding = makeEmployee({
  id: "emp_006",
  name: "Neo Mensah",
  status: "pending",
  onboardingStatus: "in_progress",
});

const roster = [active, legacyInactive, suspended, offboarded, pendingOnboarding];

describe("getIneligibilityReason", () => {
  it("allows an active employee", () => {
    expect(getIneligibilityReason(active)).toBeNull();
  });

  it("allows a pending-onboarding employee (not an inactive record)", () => {
    expect(getIneligibilityReason(pendingOnboarding)).toBeNull();
  });

  it("flags a legacy inactive employee", () => {
    expect(getIneligibilityReason(legacyInactive)).toBe("inactive");
  });

  it("flags a suspended employee even while isActive is still true", () => {
    expect(getIneligibilityReason(suspended)).toBe("suspended");
  });

  it("flags an offboarded employee as ineligible", () => {
    expect(getIneligibilityReason(offboarded)).toBe("inactive");
  });

  it("flags an employee deactivated through isActive alone", () => {
    expect(
      getIneligibilityReason(
        makeEmployee({ id: "emp_007", isActive: false }),
      ),
    ).toBe("inactive");
  });
});

describe("findIneligibleEmployees", () => {
  it("returns an empty list when every draft entry is eligible", () => {
    expect(findIneligibleEmployees(roster, ["emp_001"])).toEqual([]);
  });

  it("keeps draft order and reports name plus reason", () => {
    expect(
      findIneligibleEmployees(roster, ["emp_001", "emp_004", "emp_003"]),
    ).toEqual([
      { employeeId: "emp_004", name: "Kofi Boateng", reason: "suspended" },
      { employeeId: "emp_003", name: "Amara Diallo", reason: "inactive" },
    ]);
  });

  it("flags a stale draft id that is no longer in the roster", () => {
    const flags = findIneligibleEmployees(roster, ["emp_deleted"]);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toBe("missing_record");
  });

  it("never reports the same employee twice", () => {
    expect(findIneligibleEmployees(roster, ["emp_003", "emp_003"])).toHaveLength(
      1,
    );
  });

  it("returns nothing for an empty draft", () => {
    expect(findIneligibleEmployees(roster, [])).toEqual([]);
  });
});

describe("buildInactiveEmployeeWarning", () => {
  it("returns null when there is nothing to warn about", () => {
    expect(buildInactiveEmployeeWarning(roster, ["emp_001"])).toBeNull();
    expect(buildInactiveEmployeeWarning(roster, [])).toBeNull();
  });

  it("builds a non-blocking warning naming the affected employees", () => {
    const warning = buildInactiveEmployeeWarning(roster, [
      "emp_001",
      "emp_003",
      "emp_004",
    ]);

    expect(warning).not.toBeNull();
    expect(warning?.severity).toBe("warning");
    expect(warning?.title).toBe("Inactive or suspended employees in this payroll");
    expect(warning?.message).toContain("2 employees");
    expect(warning?.message).toContain("Amara Diallo (Inactive)");
    expect(warning?.message).toContain("Kofi Boateng (Suspended)");
    expect(warning?.nextSteps.length).toBeGreaterThan(0);
  });

  it("escalates to critical when the draft references a missing record", () => {
    const warning = buildInactiveEmployeeWarning(roster, ["emp_ghost"]);
    expect(warning?.severity).toBe("critical");
    expect(warning?.message).toContain("1 employee");
  });

  it("does not expose salary, commitment or wallet data", () => {
    const warning = buildInactiveEmployeeWarning(roster, [
      "emp_001",
      "emp_003",
      "emp_004",
      "emp_005",
    ]);
    const serialized = JSON.stringify(warning);

    expect(serialized).not.toContain("5000");
    expect(serialized).not.toContain("0xabc123def456");
    expect(serialized).not.toContain(active.address);
  });
});

describe("formatIneligibleEmployees", () => {
  it("renders readable reason labels", () => {
    expect(
      formatIneligibleEmployees([
        { employeeId: "emp_004", name: "Kofi Boateng", reason: "suspended" },
        { employeeId: "emp_x", name: "Removed", reason: "missing_record" },
      ]),
    ).toBe(
      "Kofi Boateng (Suspended), Removed (No longer in the employee roster)",
    );
  });
});

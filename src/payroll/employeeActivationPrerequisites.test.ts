import { describe, it, expect } from "vitest";
import type { Employee, UserRole } from "@/types";
import {
  evaluateActivationPrerequisites,
  findBlockedActivationEntries,
  formatBlockedActivationEntries,
  validateActivationPrerequisiteBatch,
} from "./employeeActivationPrerequisites";

const suspendedEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "emp-001",
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  name: "Kwame Asante",
  salary: 5000,
  salaryCommitment: "0xcommit",
  isActive: false,
  status: "inactive",
  onboardingStatus: "completed",
  startDate: "2025-01-01T00:00:00Z",
  lifecycleStatus: "suspended",
  ...overrides,
});

describe("evaluateActivationPrerequisites", () => {
  it("returns null when every prerequisite holds for an admin", () => {
    expect(
      evaluateActivationPrerequisites(suspendedEmployee(), "admin"),
    ).toBeNull();
  });

  it("rejects non-admin roles with an unauthorized error", () => {
    const error = evaluateActivationPrerequisites(suspendedEmployee(), "operator");
    expect(error?.code).toBe("unauthorized");
    expect(error?.message).toMatch(/only administrators/i);
  });

  it("rejects activation of an already-active employee", () => {
    const error = evaluateActivationPrerequisites(
      suspendedEmployee({ lifecycleStatus: "active", isActive: true }),
      "admin",
    );
    expect(error?.code).toBe("invalid_lifecycle_state");
    expect(error?.message).toMatch(/already active/i);
  });

  it("rejects activation of a suspended active-legacy employee (legacy isActive fallback)", () => {
    // No explicit lifecycleStatus — derivation must fall back to `isActive`.
    const error = evaluateActivationPrerequisites(
      suspendedEmployee({ lifecycleStatus: undefined, isActive: true }),
      "admin",
    );
    expect(error?.code).toBe("invalid_lifecycle_state");
  });

  it("rejects activation of offboarded and archived employees", () => {
    const offboarded = evaluateActivationPrerequisites(
      suspendedEmployee({ lifecycleStatus: "offboarded" }),
      "admin",
    );
    expect(offboarded?.code).toBe("invalid_lifecycle_state");
    expect(offboarded?.message).toMatch(/currently offboarded/i);

    const archived = evaluateActivationPrerequisites(
      suspendedEmployee({ lifecycleStatus: "archived" }),
      "admin",
    );
    expect(archived?.code).toBe("invalid_lifecycle_state");
  });

  it("blocks activation while onboarding is in progress", () => {
    const error = evaluateActivationPrerequisites(
      suspendedEmployee({ onboardingStatus: "in_progress" }),
      "admin",
    );
    expect(error?.code).toBe("onboarding_not_completed");
    expect(error?.message).toMatch(/still in progress/i);
  });

  it("blocks activation when onboarding has not been started", () => {
    const error = evaluateActivationPrerequisites(
      suspendedEmployee({ onboardingStatus: "not_started" }),
      "admin",
    );
    expect(error?.code).toBe("onboarding_not_completed");
    expect(error?.message).toMatch(/has not been completed/i);
  });

  it("never leaks salary or commitment data in error messages", () => {
    const employee = suspendedEmployee({
      salary: 99999,
      salaryCommitment: "0xSECRET",
      onboardingStatus: "in_progress",
      lifecycleStatus: "active",
    });
    for (const role of ["admin", "operator"] as UserRole[]) {
      const error = evaluateActivationPrerequisites(employee, role);
      if (error) {
        expect(error.message).not.toContain("99999");
        expect(error.message).not.toContain("0xSECRET");
      }
    }
  });
});

describe("findBlockedActivationEntries", () => {
  it("reports blockers for suspended employees with open onboarding", () => {
    const blocked = findBlockedActivationEntries(
      [
        suspendedEmployee({ id: "emp-001", name: "Amara Diallo", onboardingStatus: "in_progress" }),
        suspendedEmployee({ id: "emp-002", name: "Kofi Boateng", onboardingStatus: "not_started" }),
        suspendedEmployee({ id: "emp-003", name: "Alice Mensah" }),
      ],
      ["emp-001", "emp-002", "emp-003"],
      "admin",
    );
    expect(blocked).toHaveLength(2);
    expect(blocked).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ employeeId: "emp-001", name: "Amara Diallo" }),
        expect.objectContaining({ employeeId: "emp-002", name: "Kofi Boateng" }),
      ]),
    );
  });

  it("reports stale ids as missing_record", () => {
    const blocked = findBlockedActivationEntries(
      [suspendedEmployee({ id: "emp-001", name: "Alice Mensah" })],
      ["emp-999"],
      "admin",
    );
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toEqual({
      employeeId: "emp-999",
      name: "Unresolved employee record",
      code: "missing_record",
    });
  });

  it("reports duplicate ids once", () => {
    const blocked = findBlockedActivationEntries(
      [suspendedEmployee({ id: "emp-001", onboardingStatus: "in_progress" })],
      ["emp-001", "emp-001"],
      "admin",
    );
    expect(blocked).toHaveLength(1);
  });
});

describe("formatBlockedActivationEntries", () => {
  it("joins human-readable labels without financial data", () => {
    const entries = findBlockedActivationEntries(
      [
        suspendedEmployee({ id: "emp-001", name: "Amara Diallo", onboardingStatus: "in_progress" }),
      ],
      ["emp-001", "emp-404"],
      "admin",
    );
    const text = formatBlockedActivationEntries(entries);
    expect(text).toBe(
      "Amara Diallo (Onboarding not completed), Unresolved employee record (No longer in the employee roster)",
    );
    expect(text).not.toContain("5000");
  });
});

describe("validateActivationPrerequisiteBatch", () => {
  const roster = [
    suspendedEmployee({ id: "emp-001", name: "Amara Diallo" }),
    suspendedEmployee({ id: "emp-002", name: "Kwame Asante", onboardingStatus: "in_progress" }),
  ];

  it("proceeds when every candidate is ready", () => {
    const result = validateActivationPrerequisiteBatch(roster, ["emp-001"], "admin");
    expect(result.canProceed).toBe(true);
    expect(result.blockerMessage).toBeNull();
    expect(result.readyCount).toBe(1);
    expect(result.blockedCount).toBe(0);
  });

  it("blocks with an actionable summary when a candidate fails a prerequisite", () => {
    const result = validateActivationPrerequisiteBatch(roster, ["emp-001", "emp-002"], "admin");
    expect(result.canProceed).toBe(false);
    expect(result.blockedCount).toBe(1);
    expect(result.blockerMessage).toMatch(/1 activation entry cannot proceed/i);
    expect(result.blockerMessage).toMatch(/Kwame Asante \(Onboarding not completed\)/);
    expect(result.checks[0].ok).toBe(true);
    expect(result.checks[1].ok).toBe(false);
  });

  it("treats a non-admin role as a full block", () => {
    const result = validateActivationPrerequisiteBatch(roster, ["emp-001"], "operator");
    expect(result.canProceed).toBe(false);
    expect(result.blockerMessage).toMatch(/only administrators/i);
  });

  it("cannot proceed with no selected employees", () => {
    const result = validateActivationPrerequisiteBatch(roster, [], "admin");
    expect(result.canProceed).toBe(false);
    expect(result.blockerMessage).toMatch(/No employees selected/i);
  });
});

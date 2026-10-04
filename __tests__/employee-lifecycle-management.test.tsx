/**
 * Employee Lifecycle Management Screen (#454)
 *
 * Tests cover:
 *   1. Rendering – heading, employee rows, action buttons
 *   2. Happy-path transition – suspend an active employee via confirmation flow
 *   3. Edge case – offboarded employees show no action buttons
 *   4. Search filtering
 *   5. Validation – lifecycle store rejects unauthorized role
 *   6. Validation – lifecycle store rejects invalid transitions
 *   7. Validation – cannot offboard employee during in-progress onboarding
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmployeeLifecycleManager from "@/components/features/employees/EmployeeLifecycleManager";
import { useEmployeeStore } from "@/stores/employees";
import { useEmployeeLifecycleStore } from "@/stores/employeeLifecycle";
import type { Employee } from "@/types";
import {
  validateLifecycleTransition,
  deriveLifecycleStatus,
  availableLifecycleActions,
} from "@/src/lib/employees/lifecycleValidation";

// ── Helpers ────────────────────────────────────────────────────────────────

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "emp-test-1",
  name: "Test Employee",
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  salary: 5000,
  salaryCommitment: "0xcommit",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2025-01-01T00:00:00Z",
  lastPayment: "2025-06-01T00:00:00Z",
  ...overrides,
});

function seedEmployees(list: Employee[]) {
  useEmployeeStore.getState().setEmployees(list);
}

// ── Setup ──────────────────────────────────────────────────────────────────

describe("EmployeeLifecycleManager", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useEmployeeStore.getState().setEmployees([]);
    useEmployeeLifecycleStore.setState({ events: [], lastError: null, isProcessing: false });
  });

  // ── 1. Rendering ────────────────────────────────────────────────────────

  it("renders the section heading and employee rows", () => {
    seedEmployees([
      employee({ id: "e1", name: "Alice" }),
      employee({ id: "e2", name: "Bob" }),
    ]);

    render(<EmployeeLifecycleManager />);

    expect(screen.getByText("Employee Lifecycle Management")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("displays Suspend and Offboard buttons for active employees", () => {
    seedEmployees([employee({ id: "e1", name: "Alice", lifecycleStatus: "active" })]);

    render(<EmployeeLifecycleManager />);

    expect(screen.getByRole("button", { name: /suspend alice/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /offboard alice/i })).toBeInTheDocument();
  });

  // ── 2. Happy-path suspend flow ──────────────────────────────────────────

  it("suspends an active employee through the confirmation flow", async () => {
    const user = userEvent.setup();
    seedEmployees([employee({ id: "e1", name: "Alice", lifecycleStatus: "active" })]);

    render(<EmployeeLifecycleManager />);

    // Click Suspend
    await user.click(screen.getByRole("button", { name: /suspend alice/i }));

    // Confirmation dialog appears
    expect(screen.getByText(/confirm suspend/i)).toBeInTheDocument();
    expect(screen.getByText(/temporarily exclude/i)).toBeInTheDocument();

    // Enter a note and confirm
    await user.type(screen.getByLabelText(/note/i), "On leave");
    await user.click(screen.getByRole("button", { name: /^suspend$/i }));

    // Success message
    expect(screen.getByText(/alice has been suspended successfully/i)).toBeInTheDocument();

    // Employee store was updated
    const updated = useEmployeeStore.getState().employees.find((e) => e.id === "e1");
    expect(updated?.lifecycleStatus).toBe("suspended");
    expect(updated?.isActive).toBe(false);
    expect(updated?.lifecycleNote).toBe("On leave");

    // Audit event recorded
    const events = useEmployeeLifecycleStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("suspend");
    expect(events[0].note).toBe("On leave");
  });

  // ── 3. Edge case – offboarded employees ─────────────────────────────────

  it("shows Archive action for offboarded employees", () => {
    seedEmployees([
      employee({ id: "e1", name: "Offboarded Person", lifecycleStatus: "offboarded", isActive: false }),
    ]);

    render(<EmployeeLifecycleManager />);

    expect(screen.getByRole("button", { name: /archive offboarded person/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^activate /i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^suspend /i })).not.toBeInTheDocument();
  });

  // ── 4. Happy-path archive and restore flow ─────────────────────────────

  it("archives an offboarded employee and then restores them", async () => {
    const user = userEvent.setup();
    seedEmployees([employee({ id: "e1", name: "Alice", lifecycleStatus: "offboarded", isActive: false })]);

    render(<EmployeeLifecycleManager />);

    // Click Archive
    await user.click(screen.getByRole("button", { name: /archive alice/i }));
    expect(screen.getByText(/confirm archive/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/note/i), "Archiving inactive record");
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(screen.getByText(/alice has been archived successfully/i)).toBeInTheDocument();

    let updated = useEmployeeStore.getState().employees.find((e) => e.id === "e1");
    expect(updated?.lifecycleStatus).toBe("archived");

    // Click Restore
    await user.click(screen.getByRole("button", { name: /restore alice/i }));
    expect(screen.getByText(/confirm restore/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^restore$/i }));

    expect(screen.getByText(/alice has been restored successfully/i)).toBeInTheDocument();

    updated = useEmployeeStore.getState().employees.find((e) => e.id === "e1");
    expect(updated?.lifecycleStatus).toBe("suspended");
  });

  // ── 5. Search filtering ─────────────────────────────────────────────────

  it("filters employees by search query", async () => {
    const user = userEvent.setup();
    seedEmployees([
      employee({ id: "e1", name: "Alice Mensah", department: "Engineering" }),
      employee({ id: "e2", name: "Bob Owusu", department: "Finance" }),
    ]);

    render(<EmployeeLifecycleManager />);

    await user.type(screen.getByLabelText(/search employees/i), "Alice");

    expect(screen.getByText("Alice Mensah")).toBeInTheDocument();
    expect(screen.queryByText("Bob Owusu")).not.toBeInTheDocument();
  });
});

// ── Validation unit tests ───────────────────────────────────────────────────

describe("validateLifecycleTransition", () => {
  it("rejects non-admin users", () => {
    const err = validateLifecycleTransition(employee(), "suspend", "operator");
    expect(err).not.toBeNull();
    expect(err!.code).toBe("UNAUTHORIZED");
    expect(err!.message).toContain("administrators");
  });

  it("rejects non-admin users attempting to archive or restore", () => {
    const errArchive = validateLifecycleTransition(employee({ lifecycleStatus: "suspended" }), "archive", "operator");
    expect(errArchive?.code).toBe("UNAUTHORIZED");

    const errRestore = validateLifecycleTransition(employee({ lifecycleStatus: "archived" }), "restore", "operator");
    expect(errRestore?.code).toBe("UNAUTHORIZED");
  });

  it("rejects archiving active employees with an actionable error", () => {
    const err = validateLifecycleTransition(
      employee({ lifecycleStatus: "active" }),
      "archive",
      "admin",
    );
    expect(err).not.toBeNull();
    expect(err!.code).toBe("INVALID_TRANSITION");
    expect(err!.message).toContain("Cannot archive an active employee");
  });

  it("allows archiving suspended and offboarded employees", () => {
    const errSuspended = validateLifecycleTransition(
      employee({ lifecycleStatus: "suspended" }),
      "archive",
      "admin",
    );
    expect(errSuspended).toBeNull();

    const errOffboarded = validateLifecycleTransition(
      employee({ lifecycleStatus: "offboarded" }),
      "archive",
      "admin",
    );
    expect(errOffboarded).toBeNull();
  });

  it("allows restoring archived employees", () => {
    const err = validateLifecycleTransition(
      employee({ lifecycleStatus: "archived" }),
      "restore",
      "admin",
    );
    expect(err).toBeNull();
  });

  it("rejects offboarding when onboarding is in progress", () => {
    const err = validateLifecycleTransition(
      employee({ lifecycleStatus: "active", onboardingStatus: "in_progress" }),
      "offboard",
      "admin",
    );
    expect(err).not.toBeNull();
    expect(err!.code).toBe("ONBOARDING_IN_PROGRESS");
  });

  it("allows admin to suspend an active employee", () => {
    const err = validateLifecycleTransition(
      employee({ lifecycleStatus: "active" }),
      "suspend",
      "admin",
    );
    expect(err).toBeNull();
  });

  it("allows admin to reactivate a suspended employee", () => {
    const err = validateLifecycleTransition(
      employee({ lifecycleStatus: "suspended", isActive: false }),
      "activate",
      "admin",
    );
    expect(err).toBeNull();
  });

  it("error messages never contain salary or commitment data", () => {
    const emp = employee({ salary: 99999, salaryCommitment: "0xSECRET" });
    const err = validateLifecycleTransition(emp, "activate", "operator");
    expect(err!.message).not.toContain("99999");
    expect(err!.message).not.toContain("0xSECRET");

    const errArchive = validateLifecycleTransition(emp, "archive", "admin");
    expect(errArchive!.message).not.toContain("99999");
    expect(errArchive!.message).not.toContain("0xSECRET");
  });
});

describe("deriveLifecycleStatus", () => {
  it("returns explicit lifecycleStatus when set", () => {
    expect(deriveLifecycleStatus(employee({ lifecycleStatus: "suspended" }))).toBe("suspended");
    expect(deriveLifecycleStatus(employee({ lifecycleStatus: "archived" }))).toBe("archived");
  });

  it("falls back to isActive when lifecycleStatus is not set", () => {
    expect(deriveLifecycleStatus(employee({ isActive: true }))).toBe("active");
    expect(deriveLifecycleStatus(employee({ isActive: false }))).toBe("offboarded");
  });
});

describe("availableLifecycleActions", () => {
  it("returns empty for non-admin roles", () => {
    expect(availableLifecycleActions(employee(), "operator")).toEqual([]);
    expect(availableLifecycleActions(employee(), "auditor")).toEqual([]);
  });

  it("returns [suspend, offboard] for admin on active employee", () => {
    expect(availableLifecycleActions(employee({ lifecycleStatus: "active" }), "admin")).toEqual([
      "suspend",
      "offboard",
    ]);
  });

  it("returns [activate, archive, offboard] for admin on suspended employee", () => {
    expect(
      availableLifecycleActions(employee({ lifecycleStatus: "suspended" }), "admin"),
    ).toEqual(["activate", "archive", "offboard"]);
  });

  it("returns [archive] for offboarded employees", () => {
    expect(
      availableLifecycleActions(employee({ lifecycleStatus: "offboarded" }), "admin"),
    ).toEqual(["archive"]);
  });

  it("returns [restore] for archived employees", () => {
    expect(
      availableLifecycleActions(employee({ lifecycleStatus: "archived" }), "admin"),
    ).toEqual(["restore"]);
  });
});

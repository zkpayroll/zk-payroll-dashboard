import { describe, it, expect } from "vitest";
import {
  getInstructionVersionStatus,
  getDraftInstructionVersion,
} from "@/src/payroll/instructionVersion";
import { getWizardInstructionVersionStatus } from "@/stores/payrollWizard";
import { DEFAULT_PAYROLL_POLICY } from "@/stores/payrollPolicy";

describe("getDraftInstructionVersion (#534)", () => {
  it("snapshots the saved policy version", () => {
    expect(getDraftInstructionVersion(DEFAULT_PAYROLL_POLICY)).toBe(1);
    expect(getDraftInstructionVersion({ version: 7 })).toBe(7);
  });

  it("returns null for missing, fractional, zero, or negative versions", () => {
    expect(getDraftInstructionVersion(null)).toBeNull();
    expect(getDraftInstructionVersion(undefined)).toBeNull();
    expect(getDraftInstructionVersion({ version: 0 })).toBeNull();
    expect(getDraftInstructionVersion({ version: -3 })).toBeNull();
    expect(getDraftInstructionVersion({ version: 2.5 })).toBeNull();
    expect(getDraftInstructionVersion({ version: Number.NaN })).toBeNull();
  });
});

describe("getInstructionVersionStatus (#534)", () => {
  it("is current when the draft matches the active policy version", () => {
    const status = getInstructionVersionStatus(3, 3);
    expect(status.state).toBe("current");
    expect(status.label).toBe("v3");
    expect(status.version).toBe(3);
    expect(status.draftVersion).toBe(3);
    expect(status.detail).toMatch(/v3/);
  });

  it("is current when no draft snapshot exists (legacy drafts)", () => {
    const status = getInstructionVersionStatus(2, null);
    expect(status.state).toBe("current");
    expect(status.label).toBe("v2");
  });

  it("is stale when the active policy moved past the drafted version", () => {
    const status = getInstructionVersionStatus(4, 2);
    expect(status.state).toBe("stale");
    // The pill shows the version the run is actually governed by.
    expect(status.label).toBe("v2");
    expect(status.detail).toMatch(/newer payroll policy \(v4\)/);
    expect(status.detail).toMatch(/drafted under v2/);
    expect(status.detail).toMatch(/start a new draft/);
  });

  it("is stale with a distinct message when the draft is newer than saved", () => {
    const status = getInstructionVersionStatus(1, 5);
    expect(status.state).toBe("stale");
    expect(status.label).toBe("v5");
    expect(status.detail).toMatch(/drafted under v5/);
    expect(status.detail).toMatch(/saved payroll policy is v1/);
    expect(status.detail).toMatch(/Verify the payroll policy registry/);
  });

  it("is unconfigured when no saved policy version exists", () => {
    const status = getInstructionVersionStatus(null, 2);
    expect(status.state).toBe("unconfigured");
    expect(status.label).toBeNull();
    expect(status.detail).toMatch(/No saved payroll policy is versioned/);
  });

  it("sanitizes invalid inputs on either side", () => {
    expect(getInstructionVersionStatus(0, 1).state).toBe("unconfigured");
    expect(getInstructionVersionStatus(1, -2).state).toBe("current");
    expect(getInstructionVersionStatus(1.5, 1).state).toBe("unconfigured");
  });

  it("never includes amounts or employee identifiers in any label or detail", () => {
    const states = [
      getInstructionVersionStatus(3, 3),
      getInstructionVersionStatus(4, 2),
      getInstructionVersionStatus(1, 5),
      getInstructionVersionStatus(null, null),
    ];
    for (const status of states) {
      const text = `${status.label ?? ""} ${status.detail ?? ""}`;
      expect(text).not.toMatch(/(\$|€|£)\s?\d/);
      expect(text).not.toMatch(/G[A-Z2-7]{55}/); // Stellar address
      expect(text).not.toMatch(/emp_/); // employee id prefix
    }
  });
});

describe("getWizardInstructionVersionStatus", () => {
  it("delegates to the shared derivation with swapped operands", () => {
    expect(getWizardInstructionVersionStatus(2, 4)).toMatchObject({
      state: "stale",
      label: "v2",
    });
    expect(getWizardInstructionVersionStatus(2, 2)).toMatchObject({
      state: "current",
      label: "v2",
    });
  });
});

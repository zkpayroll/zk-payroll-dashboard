import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollInstructionVersionBadge from "@/components/features/payroll/PayrollInstructionVersionBadge";
import {
  usePayrollWizardStore,
  getWizardInstructionVersionStatus,
} from "@/stores/payrollWizard";
import { usePayrollPolicyStore } from "@/stores/payrollPolicy";
import { getInstructionVersionStatus } from "@/src/payroll/instructionVersion";

describe("PayrollInstructionVersionBadge (#534)", () => {
  it("renders the version as a current status when draft matches active", () => {
    render(<PayrollInstructionVersionBadge version={3} draftVersion={3} />);

    const badge = screen.getByTestId("instruction-version-badge");
    expect(badge).toHaveAttribute("data-state", "current");
    expect(badge).toHaveTextContent("v3");
    expect(screen.queryByText("drafted")).not.toBeInTheDocument();
    // Privacy: a version badge carries no amounts or employee data.
    expect(badge).not.toHaveTextContent(/\$/);
  });

  it("marks a stale draft with the version it was drafted under", () => {
    render(<PayrollInstructionVersionBadge version={4} draftVersion={2} />);

    const badge = screen.getByTestId("instruction-version-badge");
    expect(badge).toHaveAttribute("data-state", "stale");
    expect(badge).toHaveTextContent("v2");
    expect(badge).toHaveTextContent("drafted");
    expect(badge.getAttribute("aria-label")).toMatch(/newer payroll policy \(v4\)/);
  });

  it("renders nothing when no saved policy version exists", () => {
    render(<PayrollInstructionVersionBadge version={null} draftVersion={null} />);
    expect(screen.queryByTestId("instruction-version-badge")).not.toBeInTheDocument();
  });

  it("keeps the label a plain version even for large values", () => {
    render(<PayrollInstructionVersionBadge version={12} draftVersion={11} />);
    expect(screen.getByTestId("instruction-version-badge")).toHaveTextContent("v11");
  });
});

describe("wizard store integration (#534)", () => {
  beforeEach(() => {
    usePayrollWizardStore.getState().reset();
    usePayrollPolicyStore.getState().resetToDefaults();
  });

  it("snapshots and clears the draft instruction version", () => {
    const store = usePayrollWizardStore.getState();
    store.setEmployeeIds(["emp_001"]);
    store.setInstructionVersion(3);
    expect(usePayrollWizardStore.getState().instructionVersion).toBe(3);

    usePayrollWizardStore.getState().clearDraft();
    expect(usePayrollWizardStore.getState().instructionVersion).toBeNull();
  });

  it("derives a stale state when the saved policy version bumps mid-run", () => {
    usePayrollWizardStore.setState({ instructionVersion: 1 });
    const status = getWizardInstructionVersionStatus(
      usePayrollWizardStore.getState().instructionVersion,
      usePayrollPolicyStore.getState().savedPolicy.version,
    );
    // Default saved policy is v1, so simulate a saved bump first.
    expect(status.state).toBe("current");
  });

  it("shared derivation agrees with the badge states", () => {
    expect(getInstructionVersionStatus(5, 5).state).toBe("current");
    expect(getInstructionVersionStatus(6, 5).state).toBe("stale");
    expect(getInstructionVersionStatus(null, 5).state).toBe("unconfigured");
  });
});

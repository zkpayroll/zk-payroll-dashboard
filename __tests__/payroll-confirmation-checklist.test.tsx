import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  createDefaultConfirmationChecklist,
  toggleConfirmationCheck,
  evaluateConfirmationReadiness,
} from "@/src/payroll/confirmationChecklist";
import { PayrollConfirmationChecklist } from "@/components/checklists/PayrollConfirmationChecklist";

describe("Payroll confirmation audit checklist (Issue #268)", () => {
  it("creates the standard checklist and blocks confirmation while checks are incomplete (main path)", () => {
    const checks = createDefaultConfirmationChecklist();

    const initial = evaluateConfirmationReadiness(checks);
    expect(initial.canConfirm).toBe(false);
    expect(initial.requiredCount).toBeGreaterThan(0);
    expect(initial.unmetItems.length).toBe(initial.requiredCount);
    expect(initial.statusMessage).toMatch(/still need verification/i);
  });

  it("allows confirmation once every required check is verified", () => {
    const verified = createDefaultConfirmationChecklist(
      Object.fromEntries(
        createDefaultConfirmationChecklist()
          .filter((c) => c.isRequired)
          .map((c) => [c.id, true]),
      ),
    );

    const evaluation = evaluateConfirmationReadiness(verified);
    expect(evaluation.canConfirm).toBe(true);
    expect(evaluation.unmetItems).toHaveLength(0);
    expect(evaluation.statusMessage).toMatch(/can be confirmed/i);
    expect(evaluation.progressPercent).toBe(100);
  });

  it("toggle flips a single check and preserves the rest", () => {
    const checks = createDefaultConfirmationChecklist();
    const first = checks[0];

    const toggled = toggleConfirmationCheck(checks, first.id);
    expect(toggled[0].isVerified).toBe(true);
    expect(toggled.slice(1)).toEqual(checks.slice(1));

    const toggledBack = toggleConfirmationCheck(toggled, first.id);
    expect(toggledBack[0].isVerified).toBe(false);
  });

  it("treats an empty checklist as non-confirmable (edge case)", () => {
    const evaluation = evaluateConfirmationReadiness([]);
    expect(evaluation.canConfirm).toBe(false);
    expect(evaluation.statusMessage).toMatch(/No required confirmation checks/i);
  });

  it("optional checks never gate confirmation", () => {
    const allRequired = createDefaultConfirmationChecklist();
    const onlyOptionalUnverified = allRequired.map((c) =>
      c.isRequired ? { ...c, isVerified: true } : c,
    );

    const evaluation = evaluateConfirmationReadiness(onlyOptionalUnverified);
    expect(evaluation.canConfirm).toBe(true);
    expect(evaluation.optionalCount).toBeGreaterThan(0);
  });

  it("renders checklist status and gates the confirm button in the component", () => {
    const onConfirm = vi.fn();
    render(
      <PayrollConfirmationChecklist
        payrollRunId="run_001"
        onConfirm={onConfirm}
      />,
    );

    const panel = screen.getByTestId("payroll-confirmation-checklist");
    expect(panel).toHaveAttribute("data-can-confirm", "false");
    expect(
      screen.getByTestId("confirmation-status-message").textContent,
    ).toMatch(/still need verification/i);

    const confirmBtn = screen.getByRole("button", { name: /confirm payroll run/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // Verify every required checkbox; optional stays unchecked.
    const boxes = screen
      .getAllByRole("checkbox")
      .filter((b) => (b as HTMLInputElement).getAttribute("aria-label")?.startsWith("Verify:"));
    boxes.forEach((box) => {
      const label = box.getAttribute("aria-label")!;
      // Skip the known optional item.
      if (!label.includes("audit trail snapshot")) {
        fireEvent.click(box);
      }
    });

    expect(panel).toHaveAttribute("data-can-confirm", "true");
    expect(
      screen.getByTestId("confirmation-status-message").textContent,
    ).toMatch(/can be confirmed/i);

    const enabledBtn = screen.getByRole("button", { name: /confirm payroll run/i });
    expect(enabledBtn).toBeEnabled();
    fireEvent.click(enabledBtn);
    expect(onConfirm).toHaveBeenCalledWith("run_001");
  });
});

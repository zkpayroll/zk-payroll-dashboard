import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PayrollRun } from "@/types/models";
import { MOCK_AMENDMENTS } from "@/lib/sdk/amendments";
import { PayrollRunAmendmentReview } from "@/components/payroll/PayrollRunAmendmentReview";
import { getNextFocusIndex } from "@/src/accessibility/payrollReviewKeyboard";

const mockOriginalRun: PayrollRun = {
  id: "pr_2025_03_main",
  companyId: "comp_001",
  totalAmount: 150000,
  employeeCount: 15,
  status: "verified",
  employeeIds: ["emp_001"],
  timestamp: "2025-03-01T10:00:00Z",
  proof: "0xproof",
  createdAt: "2025-03-01T10:00:00Z",
  updatedAt: "2025-03-01T10:00:00Z",
};

const validAmendment = MOCK_AMENDMENTS[0];

describe("getNextFocusIndex focus math (Issue #271)", () => {
  it("moves forward and backward with horizontal arrows and wraps", () => {
    expect(getNextFocusIndex("ArrowRight", 0, 3)).toBe(1);
    expect(getNextFocusIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(getNextFocusIndex("ArrowRight", 2, 3)).toBe(0);
  });

  it("honours Home and End regardless of orientation", () => {
    expect(getNextFocusIndex("Home", 2, 4)).toBe(0);
    expect(getNextFocusIndex("End", 0, 4)).toBe(3);
    expect(getNextFocusIndex("Home", 1, 4, "vertical")).toBe(0);
    expect(getNextFocusIndex("End", 1, 4, "vertical")).toBe(3);
  });

  it("ignores unrelated keys and empty groups", () => {
    expect(getNextFocusIndex("Tab", 0, 3)).toBeNull();
    expect(getNextFocusIndex("a", 0, 3)).toBeNull();
    expect(getNextFocusIndex("ArrowRight", 0, 0)).toBeNull();
    expect(getNextFocusIndex("ArrowRight", 0, 1)).toBe(0);
  });

  it("uses vertical arrows in vertical orientation", () => {
    expect(getNextFocusIndex("ArrowDown", 0, 3, "vertical")).toBe(1);
    expect(getNextFocusIndex("ArrowUp", 0, 3, "vertical")).toBe(2);
    expect(getNextFocusIndex("ArrowDown", 0, 3, "horizontal")).toBeNull();
  });
});

describe("Payroll review toolbar keyboard navigation (Issue #271)", () => {
  it("exposes a labelled action toolbar with roving tabindex", () => {
    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={validAmendment}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    const toolbar = screen.getByTestId("amendment-review-actions");
    expect(toolbar).toHaveAttribute("role", "toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Amendment review actions");

    const rejectBtn = screen.getByRole("button", { name: /reject amendment/i });
    const approveBtn = screen.getByRole("button", { name: /approve amendment/i });
    // Exactly one tab stop initially.
    expect(rejectBtn).toHaveAttribute("tabindex", "0");
    expect(approveBtn).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus between review actions with Arrow keys, Home, and End", () => {
    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={validAmendment}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    const toolbar = screen.getByTestId("amendment-review-actions");
    const rejectBtn = screen.getByRole("button", { name: /reject amendment/i }) as HTMLButtonElement;
    const approveBtn = screen.getByRole("button", { name: /approve amendment/i }) as HTMLButtonElement;

    rejectBtn.focus();
    expect(document.activeElement).toBe(rejectBtn);

    fireEvent.keyDown(toolbar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(approveBtn);
    expect(rejectBtn).toHaveAttribute("tabindex", "-1");
    expect(approveBtn).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(toolbar, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(rejectBtn);

    // Wraps backwards from the first item to the last.
    fireEvent.keyDown(toolbar, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(approveBtn);

    fireEvent.keyDown(toolbar, { key: "Home" });
    expect(document.activeElement).toBe(rejectBtn);

    fireEvent.keyDown(toolbar, { key: "End" });
    expect(document.activeElement).toBe(approveBtn);
  });

  it("keeps critical actions out of the roving group when a callback is absent", () => {
    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={validAmendment}
        onApprove={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /reject amendment/i }),
    ).toBeNull();

    const approveBtn = screen.getByRole("button", { name: /approve amendment/i });
    // Sole action owns the only tab stop; keyboard activation stays an
    // explicit user step (confirmation flows upstream stay protected).
    expect(approveBtn).toHaveAttribute("tabindex", "0");

    const onApproveArg = vi.fn();
    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={validAmendment}
        onApprove={onApproveArg}
      />,
    );
    const btn = screen.getAllByRole("button", { name: /approve amendment/i })[0];
    fireEvent.click(btn);
    expect(onApproveArg).toHaveBeenCalledWith(validAmendment.id);
  });
});

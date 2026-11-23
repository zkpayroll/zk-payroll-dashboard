import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayrollCancellationReasonSelector } from "@/components/features/payroll/PayrollCancellationReasonSelector";
import { SUPPORTED_CANCELLATION_REASONS } from "@/lib/constants/cancellationReasons";

describe("PayrollCancellationReasonSelector (#514)", () => {
  it("renders cancellation reason selector with options and keeps confirm disabled until reason selected", () => {
    render(<PayrollCancellationReasonSelector selectedReasonCode="" />);

    expect(screen.getByTestId("payroll-cancellation-reason-selector")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: /Documented Cancellation Reason/i });
    expect(select).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-cancellation-btn");
    expect(confirmBtn).toBeDisabled();
  });

  it("enables confirm button when reason is selected and emits selection payload", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <PayrollCancellationReasonSelector
        onSelectReason={handleSelect}
        onConfirmCancellation={handleConfirm}
      />
    );

    const select = screen.getByRole("combobox", { name: /Documented Cancellation Reason/i });
    await user.selectOptions(select, "CALCULATION_ERROR");

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "CALCULATION_ERROR",
        reasonLabel: "Calculation Error",
      })
    );

    const confirmBtn = screen.getByTestId("confirm-cancellation-btn");
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "CALCULATION_ERROR",
      })
    );
  });

  it("allows entering audit notes and passes them in confirmation payload", async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();

    render(
      <PayrollCancellationReasonSelector
        selectedReasonCode="COMPLIANCE_HOLD"
        onConfirmCancellation={handleConfirm}
      />
    );

    const notesInput = screen.getByTestId("cancellation-notes-input");
    await user.type(notesInput, "Auditor requested compliance freeze.");

    const confirmBtn = screen.getByTestId("confirm-cancellation-btn");
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "COMPLIANCE_HOLD",
        notes: "Auditor requested compliance freeze.",
      })
    );
  });
});

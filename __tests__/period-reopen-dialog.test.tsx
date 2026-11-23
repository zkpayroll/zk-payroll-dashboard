import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PeriodReopenDialog } from "@/components/features/payroll/PeriodReopenDialog";

const VALID_REASON = "Missing employee adjustment discovered during post-close review.";

describe("PeriodReopenDialog", () => {
  it("does not render when isOpen is false", () => {
    render(
      <PeriodReopenDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );
    expect(screen.queryByTestId("period-reopen-dialog")).not.toBeInTheDocument();
  });

  it("renders with accessible dialog role, title, and period ID", () => {
    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
        employeeCount={42}
      />
    );

    const dialog = screen.getByTestId("period-reopen-dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Reopen Closed Payroll Period")).toBeInTheDocument();
    expect(screen.getByText("pay_2026_09")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Operational Risks/i)).toBeInTheDocument();
  });

  it("keeps confirm button disabled until acknowledgement checked AND reason valid", () => {
    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /Confirm reopen/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
      target: { value: VALID_REASON },
    });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmBtn).toBeDisabled();
  });

  it("shows reason character count and disables confirm for short reasons", () => {
    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    const reasonInput = screen.getByRole("textbox", { name: /reopen reason/i });

    fireEvent.change(reasonInput, { target: { value: "short" } });
    expect(screen.getByText(/5\/500 characters — minimum 10\./)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Confirm reopen/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("calls onConfirm with trimmed reason and onClose when confirmed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
      target: { value: `  ${VALID_REASON}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm reopen/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(VALID_REASON);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("handles error during onConfirm and keeps dialog open with error alert", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Audit log service unavailable"));
    const onClose = vi.fn();

    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
      target: { value: VALID_REASON },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm reopen/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Audit log service unavailable")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables confirm button until acknowledgement is checked", async () => {
    const onConfirm = vi.fn();

    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        periodId="pay_2026_09"
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
      target: { value: VALID_REASON },
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirm reopen/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmBtn).not.toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Keep period closed/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <PeriodReopenDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

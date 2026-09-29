import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PeriodFinalizationDialog } from "@/components/features/payroll/PeriodFinalizationDialog";

describe("PeriodFinalizationDialog", () => {
  it("does not render when isOpen is false", () => {
    render(
      <PeriodFinalizationDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );
    expect(screen.queryByTestId("period-finalization-dialog")).not.toBeInTheDocument();
  });

  it("renders with accessible dialog role, title, and period details", () => {
    render(
      <PeriodFinalizationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
        employeeCount={42}
        totalAmount={150000}
      />
    );

    const dialog = screen.getByTestId("period-finalization-dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Finalize & Close Payroll Period")).toBeInTheDocument();
    expect(screen.getByText("pay_2026_09")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("$150,000")).toBeInTheDocument();
    expect(screen.getByText(/Downstream Impacts & Immutability/i)).toBeInTheDocument();
  });

  it("keeps confirm button disabled until acknowledgement checkbox is checked", () => {
    render(
      <PeriodFinalizationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /Confirm & finalize period/i });
    expect(confirmBtn).toBeDisabled();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(checkbox);
    expect(confirmBtn).toBeDisabled();
  });

  it("calls onConfirm and onClose when confirmed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <PeriodFinalizationDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & finalize period/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("handles error during onConfirm and keeps dialog open with error alert", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Treasury settlement failed"));
    const onClose = vi.fn();

    render(
      <PeriodFinalizationDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & finalize period/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Treasury settlement failed")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PeriodFinalizationDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        periodId="pay_2026_09"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel and keep open/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <PeriodFinalizationDialog
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

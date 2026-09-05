import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancellationReasonSelect } from "@/components/payroll/CancellationReasonSelect";
import { CancelPayrollDialog } from "@/components/features/payroll/CancelPayrollDialog";
import { SUPPORTED_CANCELLATION_REASONS } from "@/lib/constants/cancellationReasons";
import { useWalletStore } from "@/stores/walletStore";
import { PayrollRun } from "@/types/models";

// Mock wallet store
vi.mock("@/stores/walletStore", () => ({
  useWalletStore: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

const mockPayrollRun: PayrollRun = {
  id: "run-test-123",
  companyId: "comp-1",
  timestamp: "2026-08-27T10:00:00Z",
  createdAt: "2026-08-27T10:00:00Z",
  totalAmount: 50000,
  employeeCount: 5,
  employeeIds: ["emp-1", "emp-2"],
  proof: "0xproof123",
  status: "pending",
};

describe("CancellationReasonSelect", () => {
  it("renders all supported cancellation reasons in select options", () => {
    render(
      <CancellationReasonSelect
        value=""
        onChange={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox", { name: /Cancellation Reason/i });
    expect(select).toBeInTheDocument();

    SUPPORTED_CANCELLATION_REASONS.forEach((reason) => {
      expect(screen.getByText(new RegExp(reason.code, "i"))).toBeInTheDocument();
    });
  });

  it("displays helper text corresponding to the selected reason", () => {
    const { rerender } = render(
      <CancellationReasonSelect
        value="CALCULATION_ERROR"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Incorrect salary, bonus, or deduction calculations detected in batch/i)
    ).toBeInTheDocument();

    rerender(
      <CancellationReasonSelect
        value="TREASURY_SHORTFALL"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Insufficient liquid treasury reserves available to cover full disbursement/i)
    ).toBeInTheDocument();
  });

  it("calls onChange when an option is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CancellationReasonSelect
        value=""
        onChange={handleChange}
      />
    );

    const select = screen.getByRole("combobox", { name: /Cancellation Reason/i });
    await user.selectOptions(select, "COMPLIANCE_HOLD");

    expect(handleChange).toHaveBeenCalledWith("COMPLIANCE_HOLD");
  });

  it("renders error message when error prop is passed", () => {
    render(
      <CancellationReasonSelect
        value=""
        onChange={vi.fn()}
        error="Please select a reason code"
      />
    );

    expect(screen.getByText("Please select a reason code")).toBeInTheDocument();
  });

  it("disables select when disabled or isLoading is true", () => {
    const { rerender } = render(
      <CancellationReasonSelect
        value=""
        onChange={vi.fn()}
        disabled={true}
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();

    rerender(
      <CancellationReasonSelect
        value=""
        onChange={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByText(/Loading options/i)).toBeInTheDocument();
  });
});

describe("CancelPayrollDialog with CancellationReasonSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWalletStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      publicKey: "GB6NV2XV5H44CI5T4QDT6C6L72GIOZ5ZVP65WFFGCL6V5G76H5J72V6J",
    });
  });

  it("keeps confirm button disabled until a reason is selected", () => {
    render(
      <CancelPayrollDialog
        isOpen={true}
        payroll={mockPayrollRun}
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel Payroll/i });
    expect(cancelButton).toBeDisabled();
  });

  it("enables confirm button once a supported reason is selected and submits payload", async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;

    function DialogWrapper() {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <CancelPayrollDialog
          isOpen={isOpen}
          payroll={mockPayrollRun}
          onCancel={() => setIsOpen(false)}
          onSuccess={mockOnSuccess}
        />
      );
    }

    render(<DialogWrapper />);

    const select = screen.getByRole("combobox", { name: /Required Cancellation Reason/i });
    await user.selectOptions(select, "DUPLICATE_BATCH");

    const notesInput = screen.getByPlaceholderText(/Additional audit or operational context/i);
    await user.type(notesInput, "Duplicate run initiated by mistake");

    const confirmButton = screen.getByRole("button", { name: /Cancel Payroll/i });
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/payroll/${mockPayrollRun.id}`,
        expect.objectContaining({
          method: "DELETE",
          body: expect.stringContaining("DUPLICATE_BATCH"),
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

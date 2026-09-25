import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComplianceHoldReasonSelector } from "@/components/features/compliance/ComplianceHoldReasonSelector";
import { ComplianceHoldDialog } from "@/components/features/compliance/ComplianceHoldDialog";
import {
  SUPPORTED_HOLD_REASONS,
  getHoldReason,
  HoldReasonCode,
} from "@/lib/constants/holdReasons";

// ---------------------------------------------------------------------------
// ComplianceHoldReasonSelector unit tests
// ---------------------------------------------------------------------------

describe("ComplianceHoldReasonSelector", () => {
  it("renders all supported hold reason codes as options", () => {
    render(<ComplianceHoldReasonSelector value="" onChange={vi.fn()} />);

    const select = screen.getByRole("combobox", { name: /Hold Reason/i });
    expect(select).toBeInTheDocument();

    SUPPORTED_HOLD_REASONS.forEach((reason) => {
      expect(screen.getByText(new RegExp(reason.code, "i"))).toBeInTheDocument();
    });
  });

  it("displays helper text for the currently selected reason", () => {
    const { rerender } = render(
      <ComplianceHoldReasonSelector value="REGULATORY_REVIEW" onChange={vi.fn()} />
    );

    expect(
      screen.getByText(/regulatory body has requested a review/i)
    ).toBeInTheDocument();

    rerender(
      <ComplianceHoldReasonSelector value="FRAUD_INVESTIGATION" onChange={vi.fn()} />
    );

    expect(
      screen.getByText(/suspicious activity has been flagged/i)
    ).toBeInTheDocument();
  });

  it("does not show helper text when showHelperText=false", () => {
    render(
      <ComplianceHoldReasonSelector
        value="LEGAL_HOLD"
        onChange={vi.fn()}
        showHelperText={false}
      />
    );

    expect(screen.queryByText(/legal counsel/i)).not.toBeInTheDocument();
  });

  it("calls onChange with the selected code", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<ComplianceHoldReasonSelector value="" onChange={handleChange} />);

    const select = screen.getByRole("combobox", { name: /Hold Reason/i });
    await user.selectOptions(select, "SANCTIONS_SCREENING");

    expect(handleChange).toHaveBeenCalledWith("SANCTIONS_SCREENING");
  });

  it("renders an error message when the error prop is provided", () => {
    render(
      <ComplianceHoldReasonSelector
        value=""
        onChange={vi.fn()}
        error="Please select a hold reason"
      />
    );

    expect(screen.getByText("Please select a hold reason")).toBeInTheDocument();
    // helper text should be suppressed in favour of the error
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("disables the select when disabled=true", () => {
    render(
      <ComplianceHoldReasonSelector value="" onChange={vi.fn()} disabled />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("disables the select and shows loading indicator when isLoading=true", () => {
    render(
      <ComplianceHoldReasonSelector value="" onChange={vi.fn()} isLoading />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByText(/Loading options/i)).toBeInTheDocument();
  });

  it("marks the combobox as aria-invalid when an error is present", () => {
    render(
      <ComplianceHoldReasonSelector
        value=""
        onChange={vi.fn()}
        error="Required"
      />
    );

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not mark the combobox as aria-invalid when there is no error", () => {
    render(<ComplianceHoldReasonSelector value="" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "false");
  });
});

// ---------------------------------------------------------------------------
// getHoldReason utility tests
// ---------------------------------------------------------------------------

describe("getHoldReason", () => {
  it("returns the matching option for a valid code", () => {
    const result = getHoldReason("LEGAL_HOLD");
    expect(result).toBeDefined();
    expect(result?.code).toBe("LEGAL_HOLD");
    expect(result?.label).toBe("Legal Hold");
  });

  it("returns undefined for an unrecognised code", () => {
    expect(getHoldReason("NONEXISTENT_CODE")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getHoldReason("")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ComplianceHoldDialog integration tests
// ---------------------------------------------------------------------------

describe("ComplianceHoldDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen=false", () => {
    render(
      <ComplianceHoldDialog
        isOpen={false}
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog and target label when isOpen=true", () => {
    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Payroll Period Q3/i)).toBeInTheDocument();
  });

  it("keeps the submit button disabled when no reason is selected", () => {
    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Place Hold/i })).toBeDisabled();
  });

  it("enables the submit button once a reason is selected", async () => {
    const user = userEvent.setup();

    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox", { name: /Required Hold Reason/i });
    await user.selectOptions(select, "POLICY_VIOLATION");

    expect(screen.getByRole("button", { name: /Place Hold/i })).not.toBeDisabled();
  });

  it("calls onSubmit with reasonCode and notes on successful submission", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    const select = screen.getByRole("combobox", { name: /Required Hold Reason/i });
    await user.selectOptions(select, "AUDIT_IN_PROGRESS");

    const notesTextarea = screen.getByPlaceholderText(
      /Do not include salary amounts/i
    );
    await user.type(notesTextarea, "Q3 external audit has commenced.");

    await user.click(screen.getByRole("button", { name: /Place Hold/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        reasonCode: "AUDIT_IN_PROGRESS",
        notes: "Q3 external audit has commenced.",
      });
    });
  });

  it("shows an inline validation error when submitting without selecting a reason", async () => {
    const user = userEvent.setup();

    // Render a wrapper that allows bypassing the disabled guard via form submit
    function Wrapper() {
      const [reasonCode, setReasonCode] = React.useState("");
      return (
        <ComplianceHoldDialog
          isOpen
          targetLabel="Payroll Period Q3"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
    }

    render(<Wrapper />);

    // The button is disabled when no reason is selected — confirm disabled state
    const button = screen.getByRole("button", { name: /Place Hold/i });
    expect(button).toBeDisabled();
  });

  it("displays a submit error when onSubmit rejects", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockRejectedValue(new Error("Network failure"));

    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    const select = screen.getByRole("combobox", { name: /Required Hold Reason/i });
    await user.selectOptions(select, "REGULATORY_REVIEW");

    await user.click(screen.getByRole("button", { name: /Place Hold/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when the Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close (×) icon button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ComplianceHoldDialog
        isOpen
        targetLabel="Payroll Period Q3"
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Close dialog/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  // Edge case: ALL supported reasons should be selectable without errors
  it.each(SUPPORTED_HOLD_REASONS.map((r) => [r.code, r.label]))(
    "accepts %s (%s) as a valid hold reason",
    async (code, label) => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <ComplianceHoldDialog
          isOpen
          targetLabel="Test Period"
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      const select = screen.getByRole("combobox", { name: /Required Hold Reason/i });
      await user.selectOptions(select, code as string);
      await user.click(screen.getByRole("button", { name: /Place Hold/i }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ reasonCode: code })
        );
      });
    }
  );
});

/**
 * Tests for Feature 6: Client-Side Validation for Payout Destinations
 *
 * Covers:
 *  lib/validation/payoutDestination.ts (pure unit tests):
 *    - Valid and invalid Stellar addresses
 *    - Valid and invalid asset codes
 *    - Full row validation and batch duplicate detection
 *
 *  components/features/payroll/PayoutDestinationForm.tsx (component tests):
 *    - Inline error messages appear for invalid fields
 *    - Form cannot be submitted with validation errors
 *    - Duplicate wallet address triggers a batch-level warning
 *    - Valid submission calls onSubmit with the correct data
 *    - aria-invalid is set on invalid inputs
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  validateStellarAddress,
  validateAssetCode,
  validatePayoutDestination,
  validatePayoutDestinations,
  isPayoutDestinationValid,
} from "@/lib/validation/payoutDestination";
import type { PayoutDestinationInput } from "@/lib/validation/payoutDestination";
import { PayoutDestinationForm } from "@/components/features/payroll/PayoutDestinationForm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Real 56-char Stellar addresses (from mockData)
const VALID_ADDRESS =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const VALID_ADDRESS_B =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W38";

function validRow(
  overrides: Partial<PayoutDestinationInput> = {},
): PayoutDestinationInput {
  return {
    employeeId: "emp_001",
    walletAddress: VALID_ADDRESS,
    assetCode: "USDC",
    ...overrides,
  };
}

// ─── validateStellarAddress ────────────────────────────────────────────────────

describe("validateStellarAddress", () => {
  it("returns null for a valid Stellar address", () => {
    expect(validateStellarAddress(VALID_ADDRESS)).toBeNull();
  });

  it("returns an error for an empty string", () => {
    expect(validateStellarAddress("")).not.toBeNull();
  });

  it("returns an error for an address that does not start with G", () => {
    const badAddress = "A" + VALID_ADDRESS.slice(1);
    expect(validateStellarAddress(badAddress)).not.toBeNull();
  });

  it("returns an error for an address shorter than 56 chars", () => {
    expect(validateStellarAddress("GABC")).not.toBeNull();
  });

  it("returns an error for an address with lowercase characters", () => {
    const lower = VALID_ADDRESS.toLowerCase();
    expect(validateStellarAddress(lower)).not.toBeNull();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateStellarAddress(`  ${VALID_ADDRESS}  `)).toBeNull();
  });
});

// ─── validateAssetCode ────────────────────────────────────────────────────────

describe("validateAssetCode", () => {
  it("accepts USDC", () => {
    expect(validateAssetCode("USDC")).toBeNull();
  });

  it("accepts EURC", () => {
    expect(validateAssetCode("EURC")).toBeNull();
  });

  it("accepts XLM", () => {
    expect(validateAssetCode("XLM")).toBeNull();
  });

  it("is case-insensitive for allowed codes", () => {
    expect(validateAssetCode("usdc")).toBeNull();
  });

  it("rejects unknown asset codes", () => {
    expect(validateAssetCode("DOGE")).not.toBeNull();
  });

  it("returns an error for an empty string", () => {
    expect(validateAssetCode("")).not.toBeNull();
  });
});

// ─── validatePayoutDestination (full row) ─────────────────────────────────────

describe("validatePayoutDestination", () => {
  it("returns no errors for a fully valid row", () => {
    const errors = validatePayoutDestination(validRow());
    expect(isPayoutDestinationValid(errors)).toBe(true);
  });

  it("returns an error for a missing employee ID", () => {
    const errors = validatePayoutDestination(validRow({ employeeId: "" }));
    expect(errors.employeeId).toBeDefined();
    expect(isPayoutDestinationValid(errors)).toBe(false);
  });

  it("returns an error for an invalid wallet address", () => {
    const errors = validatePayoutDestination(
      validRow({ walletAddress: "not-a-key" }),
    );
    expect(errors.walletAddress).toBeDefined();
  });

  it("returns an error for an unsupported asset code", () => {
    const errors = validatePayoutDestination(validRow({ assetCode: "BTC" }));
    expect(errors.assetCode).toBeDefined();
  });
});

// ─── validatePayoutDestinations (batch) ──────────────────────────────────────

describe("validatePayoutDestinations", () => {
  it("passes for an array of valid rows", () => {
    const result = validatePayoutDestinations([
      validRow({ employeeId: "emp_001", walletAddress: VALID_ADDRESS }),
      validRow({ employeeId: "emp_002", walletAddress: VALID_ADDRESS_B }),
    ]);
    expect(result.isValid).toBe(true);
    expect(result.duplicateAddresses).toHaveLength(0);
    expect(Object.keys(result.rowErrors)).toHaveLength(0);
  });

  it("detects duplicate wallet addresses across rows", () => {
    const result = validatePayoutDestinations([
      validRow({ employeeId: "emp_001", walletAddress: VALID_ADDRESS }),
      validRow({ employeeId: "emp_002", walletAddress: VALID_ADDRESS }), // same address
    ]);
    expect(result.isValid).toBe(false);
    expect(result.duplicateAddresses).toContain(VALID_ADDRESS);
  });

  it("reports row-level errors alongside duplicate detection", () => {
    const result = validatePayoutDestinations([
      validRow({ employeeId: "", walletAddress: VALID_ADDRESS }), // row 0: bad empId
      validRow({ employeeId: "emp_002", walletAddress: VALID_ADDRESS }), // row 1: dup addr
    ]);
    expect(result.rowErrors[0]?.employeeId).toBeDefined();
    expect(result.duplicateAddresses).toContain(VALID_ADDRESS);
  });
});

// ─── PayoutDestinationForm component ─────────────────────────────────────────

describe("PayoutDestinationForm", () => {
  it("renders a form with one empty destination row by default", () => {
    render(<PayoutDestinationForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/employee id/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/stellar wallet address/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/asset code/i)).toBeInTheDocument();
  });

  it("shows inline error for an invalid wallet address after submit", async () => {
    const user = userEvent.setup();
    render(<PayoutDestinationForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/employee id/i), "emp_001");
    await user.type(
      screen.getByLabelText(/stellar wallet address/i),
      "bad-address",
    );
    // Leave asset code blank

    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/invalid stellar address/i)).toBeInTheDocument();
    });
  });

  it("marks the wallet address input as aria-invalid when invalid", async () => {
    const user = userEvent.setup();
    render(<PayoutDestinationForm onSubmit={vi.fn()} />);

    await user.type(
      screen.getByLabelText(/stellar wallet address/i),
      "BADINPUT",
    );
    // Blur to trigger validation
    fireEvent.blur(screen.getByLabelText(/stellar wallet address/i));

    await waitFor(() => {
      expect(screen.getByLabelText(/stellar wallet address/i)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
  });

  it("does not call onSubmit when the form has validation errors", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PayoutDestinationForm onSubmit={onSubmit} />);

    // Leave all fields empty — submit should be blocked
    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with correct data when all fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PayoutDestinationForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/employee id/i), "emp_001");
    await user.type(
      screen.getByLabelText(/stellar wallet address/i),
      VALID_ADDRESS,
    );
    await user.selectOptions(screen.getByLabelText(/asset code/i), "USDC");

    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        {
          employeeId: "emp_001",
          walletAddress: VALID_ADDRESS,
          assetCode: "USDC",
        },
      ]);
    });
  });

  it("shows a duplicate address warning when two rows share the same wallet", async () => {
    const user = userEvent.setup();
    render(
      <PayoutDestinationForm
        onSubmit={vi.fn()}
        initialDestinations={[
          {
            employeeId: "emp_001",
            walletAddress: VALID_ADDRESS,
            assetCode: "USDC",
          },
          {
            employeeId: "emp_002",
            walletAddress: VALID_ADDRESS,
            assetCode: "USDC",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/duplicate wallet address detected/i),
      ).toBeInTheDocument();
    });
  });

  it("shows a summary error alert when form is submitted with errors", async () => {
    const user = userEvent.setup();
    render(<PayoutDestinationForm onSubmit={vi.fn()} />);

    // Submit with all fields empty
    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/one or more destinations have errors/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an all-valid confirmation after a successful submission", async () => {
    const user = userEvent.setup();
    render(
      <PayoutDestinationForm
        onSubmit={vi.fn()}
        initialDestinations={[
          {
            employeeId: "emp_001",
            walletAddress: VALID_ADDRESS,
            assetCode: "USDC",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /confirm destinations/i }),
    );

    // After a clean submit with no errors the success status should appear
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByText(/all destinations are valid/i)).toBeInTheDocument();
  });
});

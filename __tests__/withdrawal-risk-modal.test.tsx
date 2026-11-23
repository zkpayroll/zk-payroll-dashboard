/**
 * @vitest-environment jsdom
 *
 * Tests for the withdrawal risk modal (issue #323).
 *
 * Covers:
 *   - Pure computation: safe, risky, blocked withdrawal risk levels
 *   - Component rendering: balance breakdown display for each risk level
 *   - Interaction flows: confirm, cancel, blocked, risky-acknowledged
 *   - Asset-aware balances
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { computeWithdrawalRisk } from "@/lib/treasury/withdrawalRisk";
import { useTreasuryStore, type TreasuryBalance, type PayrollObligation } from "@/stores/treasury";
import { WithdrawalRiskModal } from "@/components/features/treasury/WithdrawalRiskModal";

// ---------------------------------------------------------------------------
// Mock sonner to prevent act() warnings from toast
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DEFAULT_BALANCE: TreasuryBalance = {
  assetCode: "USDC",
  available: 45_000,
  reserved: 15_000,
  projected: 19_500,
};

const OBLIGATIONS: PayrollObligation[] = [
  {
    id: "obl_1",
    name: "April Payroll",
    amount: 15_000,
    assetCode: "USDC",
    scheduledDate: "2025-04-30T00:00:00Z",
    lockedAt: "2025-04-15T10:00:00Z",
  },
];

function setupTreasuryStore(overrides?: Partial<TreasuryBalance>) {
  const assetCode = overrides?.assetCode ?? "USDC";
  const defaultForAsset = assetCode === "USDC" ? DEFAULT_BALANCE : { assetCode, available: 0, reserved: 0, projected: 0 };
  useTreasuryStore.setState({
    balances: {
      [assetCode]: { ...defaultForAsset, ...overrides },
    },
    obligations: [...OBLIGATIONS],
    lastUpdated: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Pure computation tests
// ---------------------------------------------------------------------------
describe("computeWithdrawalRisk", () => {
  it("returns safe when withdrawal is within surplus", () => {
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 5_000, []);

    expect(result.riskLevel).toBe("safe");
    expect(result.details.postWithdrawal).toBe(40_000);
    expect(result.details.violatesReserved).toBe(false);
    expect(result.details.fallsBelowBuffer).toBe(false);
    expect(result.assetLabel).toBe("USDC");
  });

  it("returns risky when withdrawal reduces buffer but stays above threshold", () => {
    // Available 45k, reserved 15k, obligations 15k. Withdrawing 12k → post = 33k.
    // 33k < 15k (obligations) + 25k (buffer) = 40k → risky
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 12_000, OBLIGATIONS);

    expect(result.riskLevel).toBe("risky");
    expect(result.details.postWithdrawal).toBe(33_000);
    expect(result.message).toMatch(/reduce the USDC surplus/i);
  });

  it("returns blocked when withdrawal exceeds available balance", () => {
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 50_000, []);

    expect(result.riskLevel).toBe("blocked");
    expect(result.details.violatesReserved).toBe(true);
    expect(result.message).toMatch(/exceed/i);
  });

  it("returns blocked when withdrawal falls below safety buffer", () => {
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 22_000, []);

    expect(result.riskLevel).toBe("blocked");
    expect(result.details.fallsBelowBuffer).toBe(true);
    expect(result.message).toMatch(/safety buffer/i);
  });

  it("uses custom buffer reserve when provided", () => {
    // With a lower buffer, 22k withdrawal becomes safe (post = 23k > 10k buffer)
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 22_000, [], 10_000);

    expect(result.riskLevel).toBe("safe");
    expect(result.details.postWithdrawal).toBe(23_000);
  });

  it("returns blocked for zero balance with any positive withdrawal", () => {
    const zeroBalance: TreasuryBalance = {
      assetCode: "USDC",
      available: 0,
      reserved: 0,
      projected: 0,
    };
    const result = computeWithdrawalRisk(zeroBalance, 1, []);

    expect(result.riskLevel).toBe("blocked");
    expect(result.details.violatesReserved).toBe(true);
  });

  it("is asset-aware for non-USDC assets", () => {
    const xlmBalance: TreasuryBalance = {
      assetCode: "XLM",
      available: 50_000,
      reserved: 0,
      projected: 5_000,
    };
    const result = computeWithdrawalRisk(xlmBalance, 1_000, []);

    expect(result.riskLevel).toBe("safe");
    expect(result.assetLabel).toBe("XLM");
  });

  it("accounts for obligations in risk calculation", () => {
    // Available 45k, obligation total 15k, buffer 25k → need 40k after withdrawal
    // Withdrawing 10k → post = 35k < 40k → risky
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 10_000, OBLIGATIONS);

    expect(result.riskLevel).toBe("risky");
    expect(result.details.obligationTotal).toBe(15_000);
  });

  it("filters obligations by asset code", () => {
    const xlmObligation: PayrollObligation = {
      id: "obl_xlm",
      name: "XLM Payroll",
      amount: 50_000,
      assetCode: "XLM",
      scheduledDate: "2025-04-30T00:00:00Z",
      lockedAt: "2025-04-15T10:00:00Z",
    };
    // Only USDC obligations should count for USDC balance
    const result = computeWithdrawalRisk(DEFAULT_BALANCE, 5_000, [
      OBLIGATIONS[0],
      xlmObligation,
    ]);

    expect(result.details.obligationTotal).toBe(15_000);
    expect(result.riskLevel).toBe("safe");
  });
});

// ---------------------------------------------------------------------------
// Component rendering tests
// ---------------------------------------------------------------------------
describe("<WithdrawalRiskModal />", () => {
  beforeEach(() => {
    setupTreasuryStore();
  });

  it("renders null when isOpen is false", () => {
    const { container } = render(
      <WithdrawalRiskModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("displays balance breakdown in the modal", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    expect(screen.getByTestId("available-balance")).toHaveTextContent("$45,000");
    expect(screen.getByTestId("reserved-balance")).toHaveTextContent("$15,000");
    expect(screen.getByTestId("projected-balance")).toHaveTextContent("$19,500");
    expect(screen.getByTestId("withdrawal-amount")).toHaveTextContent("-$5,000");
    expect(screen.getByTestId("post-withdrawal-balance")).toHaveTextContent("$40,000");
  });

  it("shows safe state with green confirmation message", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    expect(screen.getByText("Withdrawal Approved")).toBeInTheDocument();
    expect(screen.getByText(/within the available surplus/)).toBeInTheDocument();
    expect(screen.getByText("Proceed")).toBeInTheDocument();
  });

  it("shows risky state with acknowledgment checkbox", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={12_000}
      />,
    );

    expect(screen.getByText("Risky Withdrawal")).toBeInTheDocument();
    expect(screen.getByText(/Explicit confirmation is required/i)).toBeInTheDocument();
    expect(screen.getByText("Confirm Withdrawal")).toBeInTheDocument();
    expect(screen.getByTestId("acknowledgment-label")).toBeInTheDocument();
  });

  it("shows blocked state with violation alert", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={50_000}
      />,
    );

    expect(screen.getByText("Withdrawal Blocked")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByTestId("violation-alert")).toBeInTheDocument();
    expect(screen.getByText(/exceed available USDC balance/)).toBeInTheDocument();
  });

  it("shows blocked state when below safety buffer", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={22_000}
      />,
    );

    expect(screen.getByText("Withdrawal Blocked")).toBeInTheDocument();
    const matches = screen.getAllByText(/safety buffer/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("displays asset label for non-default assets", () => {
    setupTreasuryStore({
      assetCode: "XLM",
      available: 50_000,
      reserved: 0,
      projected: 5_000,
    });

    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={1_000}
        assetCode="XLM"
      />,
    );

    const xlmMatches = screen.getAllByText(/XLM/);
    expect(xlmMatches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("available-balance")).toHaveTextContent("$50,000");
  });
});

// ---------------------------------------------------------------------------
// Interaction flow tests
// ---------------------------------------------------------------------------
describe("WithdrawalRiskModal interactions", () => {
  beforeEach(() => {
    setupTreasuryStore();
  });

  it("calls onConfirm immediately for safe withdrawals", () => {
    const onConfirm = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        withdrawalAmount={5_000}
      />,
    );

    fireEvent.click(screen.getByText("Proceed"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm for risky withdrawals without acknowledgment", () => {
    const onConfirm = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        withdrawalAmount={12_000}
      />,
    );

    fireEvent.click(screen.getByText("Confirm Withdrawal"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm for risky withdrawals after acknowledgment", () => {
    const onConfirm = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        withdrawalAmount={12_000}
      />,
    );

    const checkbox = screen.getByLabelText(/I acknowledge the withdrawal risk/i);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText("Confirm Withdrawal"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm for blocked withdrawals", () => {
    const onConfirm = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        withdrawalAmount={50_000}
      />,
    );

    fireEvent.click(screen.getByText("Blocked"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets acknowledgment state when modal closes and reopens", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        withdrawalAmount={12_000}
      />,
    );

    // Check the box
    const checkbox = screen.getByLabelText(/I acknowledge the withdrawal risk/i);
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);

    // Close
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();

    // Reopen
    rerender(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        withdrawalAmount={12_000}
      />,
    );

    const reopenedCheckbox = screen.getByLabelText(/I acknowledge the withdrawal risk/i);
    expect((reopenedCheckbox as HTMLInputElement).checked).toBe(false);
  });

  it("shows obligation total in balance breakdown", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    expect(screen.getByTestId("obligation-total")).toHaveTextContent("$15,000");
  });

  it("renders balance breakdown section heading", () => {
    render(
      <WithdrawalRiskModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        withdrawalAmount={5_000}
      />,
    );

    expect(screen.getByText(/Balance Breakdown/)).toBeInTheDocument();
  });
});

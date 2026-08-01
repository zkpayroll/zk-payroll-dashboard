import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransactionDetailDrawer from "@/components/features/transactions/TransactionDetailDrawer";
import type { PayrollTransaction } from "@/types";

const mockTransaction: PayrollTransaction = {
  id: "tx_001",
  companyId: "company_001",
  timestamp: "2025-02-28T09:01:00Z",
  createdAt: "2025-02-28T09:01:00Z",
  totalAmount: 9500,
  employeeCount: 2,
  proof: "0xzkproof_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  status: "verified",
  txHash: "abc123def456ghi789jkl012",
};

describe("TransactionDetailDrawer", () => {
  it("renders transaction details when open", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText("Transaction Details")).toBeInTheDocument();
    expect(screen.getByText("tx_001")).toBeInTheDocument();
    expect(screen.getByText("$9,500")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("displays verified status correctly", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
  });

  it("displays pending status correctly", () => {
    const onOpenChange = vi.fn();
    const pendingTx = { ...mockTransaction, status: "pending" as const };

    render(
      <TransactionDetailDrawer
        transaction={pendingTx}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  });

  it("masks ZK proof by default", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    // Should show masked version
    expect(screen.queryByText(mockTransaction.proof)).not.toBeInTheDocument();
  });

  it("reveals ZK proof when show button is clicked", async () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const showButton = screen.getByRole("button", { name: /show/i });
    fireEvent.click(showButton);

    await waitFor(() => {
      expect(screen.getByText(mockTransaction.proof)).toBeInTheDocument();
    });
  });

  it("displays transaction hash and explorer link", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText(mockTransaction.txHash!)).toBeInTheDocument();
    expect(screen.getByText("View on Explorer")).toBeInTheDocument();
  });

  it("copies transaction hash to clipboard", async () => {
    const onOpenChange = vi.fn();
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const copyButton = screen.getAllByRole("button", { name: /copy/i })[0];
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(mockTransaction.txHash);
    });
  });

  it("shows privacy notice", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText("Privacy Protected")).toBeInTheDocument();
    expect(
      screen.getByText(/Individual employee salaries and personal information remain encrypted/i)
    ).toBeInTheDocument();
  });

  it("does not render when transaction is null", () => {
    const onOpenChange = vi.fn();

    const { container } = render(
      <TransactionDetailDrawer
        transaction={null}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not show blockchain section when txHash is not present", () => {
    const onOpenChange = vi.fn();
    const txWithoutHash = { ...mockTransaction, txHash: undefined };

    render(
      <TransactionDetailDrawer
        transaction={txWithoutHash}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.queryByText("Blockchain Details")).not.toBeInTheDocument();
  });

  it("formats dates correctly", () => {
    const onOpenChange = vi.fn();

    render(
      <TransactionDetailDrawer
        transaction={mockTransaction}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getAllByText("February 28, 2025").length).toBeGreaterThan(0);
  });

  describe("accessibility", () => {
    it("renders as a modal dialog", () => {
      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      // Radix labels the dialog with the SheetTitle for screen readers.
      expect(dialog).toHaveAccessibleName(/transaction details/i);
    });

    it("exposes a close control with an accessible name", () => {
      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /close/i })
      ).toBeInTheDocument();
    });

    it("closes when the Escape key is pressed", async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("moves focus into the drawer when it opens", async () => {
      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      const dialog = screen.getByRole("dialog");
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it("exposes the ZK proof toggle with an accessible name and state", async () => {
      const user = userEvent.setup();

      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      const toggle = screen.getByRole("button", {
        name: /show zero-knowledge proof/i,
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);

      const collapse = screen.getByRole("button", {
        name: /hide zero-knowledge proof/i,
      });
      expect(collapse).toHaveAttribute("aria-expanded", "true");
    });

    it("gives copy controls descriptive accessible names", () => {
      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /copy transaction hash/i })
      ).toBeInTheDocument();
    });

    it("announces clipboard actions via a live region", async () => {
      const mockWriteText = vi.fn();
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        configurable: true,
      });

      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /copy transaction hash/i })
      );

      const status = await screen.findByText(/copied to clipboard/i);
      expect(status).toHaveTextContent(/copied to clipboard/i);
    });

    it("labels the explorer link as opening in a new tab", () => {
      render(
        <TransactionDetailDrawer
          transaction={mockTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      const link = screen.getByRole("link", {
        name: /opens in a new tab/i,
      });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});

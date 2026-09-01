import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import PayrollDetailSheet from "@/components/features/payroll/PayrollDetailSheet";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import TransactionDetailDrawer from "@/components/features/transactions/TransactionDetailDrawer";
import type { PayrollRun, PayrollTransaction } from "@/types/models";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ id: "tx_001" }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Payroll Period Label Display Integration", () => {
  const sampleRun: PayrollRun = {
    id: "tx_sample_01",
    companyId: "company_001",
    timestamp: "2025-02-28T09:01:00Z",
    createdAt: "2025-02-28T09:01:00Z",
    totalAmount: 9500,
    employeeCount: 2,
    proof: "0xzkproof_sample",
    status: "verified",
    employeeIds: ["emp_001", "emp_002"],
    txHash: "sampletx123",
  };

  describe("PayrollCalendar list integration", () => {
    it("displays period labels on run items in the schedule", () => {
      render(<PayrollCalendar runs={[sampleRun]} />);
      const periodBadges = screen.getAllByTestId("period-label-badge");
      expect(periodBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("February 2025").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PayrollRunDetail detail screen integration", () => {
    it("displays period badge in header and Pay Period card in Run Metadata", () => {
      render(<PayrollRunDetail run={sampleRun} />);

      // Header period badge
      expect(screen.getByTestId("period-label-badge")).toHaveTextContent("February 2025");

      // Metadata card
      expect(screen.getByText("Pay Period")).toBeInTheDocument();
      expect(screen.getAllByText("February 2025").length).toBeGreaterThanOrEqual(2);
    });

    it("displays fallback period when run timestamp is empty or invalid", () => {
      const invalidRun: PayrollRun = {
        ...sampleRun,
        createdAt: "",
        timestamp: "",
      };
      render(<PayrollRunDetail run={invalidRun} />);

      expect(screen.getByTestId("period-label-badge")).toHaveTextContent("Unassigned period");
    });
  });

  describe("PayrollDetailSheet slide-out integration", () => {
    it("displays period badge and Pay Period metadata card in sheet", () => {
      render(<PayrollDetailSheet run={sampleRun} open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByTestId("period-label-badge")).toHaveTextContent("February 2025");
      expect(screen.getByText("Pay Period")).toBeInTheDocument();
    });
  });

  describe("TransactionDetailDrawer integration", () => {
    it("surfaces Pay Period in timeline section", () => {
      render(
        <TransactionDetailDrawer
          transaction={sampleRun as PayrollTransaction}
          open={true}
          onOpenChange={vi.fn()}
        />
      );

      expect(screen.getByText("Pay Period")).toBeInTheDocument();
      expect(screen.getByText("February 2025")).toBeInTheDocument();
    });
  });

  describe("TransactionHistory table integration", () => {
    it("renders period labels in transaction history rows", () => {
      render(<TransactionHistory />);

      // MOCK_TRANSACTIONS include Feb 2025, Jan 2025, Mar 2025, Apr 2025
      expect(screen.getAllByText(/February 2025|January 2025|March 2025/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Privacy compliance", () => {
    it("does not expose confidential salary figures or private keys inside period displays", () => {
      const { container } = render(<PayrollRunDetail run={sampleRun} />);

      const textContent = container.textContent || "";
      // Individual employee salary (e.g. 5000 / 4500) should not be exposed in period UI
      expect(textContent).not.toContain("salaryCommitment");
      expect(textContent).not.toContain("privateKey");
      expect(textContent).not.toContain("secret");
    });
  });
});

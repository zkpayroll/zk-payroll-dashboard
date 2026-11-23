import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OperationsCommandCenter from "@/components/features/operations/OperationsCommandCenter";
import { useOperationsStore } from "@/stores/operations";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

describe("OperationsCommandCenter Contract Pause Behavior", () => {
  beforeEach(() => {
    useCompanyWarningsStore.getState().reset();
    useOperationsStore.setState({
      cards: [
        { id: "payroll-batches", title: "Pending Payroll Batches", description: "3 batches", state: "requires-review", link: "/payroll/execute" },
        { id: "treasury", title: "Treasury Readiness", description: "Balance OK", state: "healthy", link: "/treasury" },
        { id: "audit", title: "Audit Requests", description: "2 requests", state: "urgent", link: "/compliance" },
        { id: "failed-execution", title: "Failed Execution", description: "1 run failed", state: "blocked", link: "/payroll/recovery" },
        { id: "approvals", title: "Pending Approvals", description: "4 items", state: "requires-review", link: "/payroll/approvals" },
      ],
      filter: "all",
    });
  });

  describe("Successful case (Contracts Active)", () => {
    it("renders all cards as active links without pause alert banner when contracts are running", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: false });

      render(<OperationsCommandCenter />);

      // No alert banner
      expect(screen.queryByTestId("operations-contract-paused-alert")).not.toBeInTheDocument();

      // Mutation cards are normal links
      const payrollCard = screen.getByTestId("card-payroll-batches");
      expect(payrollCard.tagName).toBe("A");
      expect(payrollCard).toHaveAttribute("href", "/payroll/execute");
      expect(payrollCard).not.toHaveAttribute("aria-disabled");

      const approvalsCard = screen.getByTestId("card-approvals");
      expect(approvalsCard.tagName).toBe("A");
      expect(approvalsCard).toHaveAttribute("href", "/payroll/approvals");
    });
  });

  describe("Rejected case (Contracts Paused)", () => {
    it("disables mutation cards and displays alert banner when contracts are paused", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<OperationsCommandCenter />);

      // Pause alert banner is displayed
      const alert = screen.getByTestId("operations-contract-paused-alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Smart Contracts Paused — Mutation Actions Disabled/i);
      expect(alert).toHaveTextContent(/CONTRACT_PAUSED/i);

      // Mutation cards are converted to disabled divs rather than links
      const payrollCard = screen.getByTestId("card-payroll-batches");
      expect(payrollCard.tagName).toBe("DIV");
      expect(payrollCard).toHaveAttribute("aria-disabled", "true");
      expect(payrollCard).toHaveAttribute("data-mutation-disabled", "true");
      expect(payrollCard).toHaveTextContent(/Action paused until contracts resume/i);

      const failedCard = screen.getByTestId("card-failed-execution");
      expect(failedCard.tagName).toBe("DIV");
      expect(failedCard).toHaveAttribute("aria-disabled", "true");

      const approvalsCard = screen.getByTestId("card-approvals");
      expect(approvalsCard.tagName).toBe("DIV");
      expect(approvalsCard).toHaveAttribute("aria-disabled", "true");
    });

    it("ensures pause alert does not leak employee IDs, wallet addresses, or salary numbers", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<OperationsCommandCenter />);
      const alert = screen.getByTestId("operations-contract-paused-alert");

      // Verify privacy preservation: no raw dollar amounts, asset values, or employee ids
      expect(alert.textContent).not.toMatch(/\$\d+|\b\d+\s*(?:USD|USDC|XLM)\b|\bemp_[a-zA-Z0-9_-]+\b/i);
    });
  });

  describe("Boundary cases", () => {
    it("leaves non-mutation cards (Treasury, Audit) active even when contracts are paused", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<OperationsCommandCenter />);

      // Non-mutation cards must remain active and accessible
      const treasuryCard = screen.getByTestId("card-treasury");
      expect(treasuryCard.tagName).toBe("A");
      expect(treasuryCard).toHaveAttribute("href", "/treasury");
      expect(treasuryCard).not.toHaveAttribute("aria-disabled");

      const auditCard = screen.getByTestId("card-audit");
      expect(auditCard.tagName).toBe("A");
      expect(auditCard).toHaveAttribute("href", "/compliance");
      expect(auditCard).not.toHaveAttribute("aria-disabled");
    });

    it("filters properly when mutation cards transition to blocked state due to pause", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<OperationsCommandCenter />);

      // Click 'Blocked' filter
      fireEvent.click(screen.getByRole("button", { name: "Blocked" }));

      // Under blocked filter, all mutation cards are now classified as blocked
      expect(screen.getByTestId("card-payroll-batches")).toBeInTheDocument();
      expect(screen.getByTestId("card-failed-execution")).toBeInTheDocument();
      expect(screen.getByTestId("card-approvals")).toBeInTheDocument();
      // Treasury is healthy, so it should not appear
      expect(screen.queryByTestId("card-treasury")).not.toBeInTheDocument();
    });
  });
});

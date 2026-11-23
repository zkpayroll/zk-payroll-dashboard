import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PayrollDashboardPage from "@/app/payroll/page.tsx";
import PayrollCreatePage from "@/app/payroll/create/page.tsx";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

describe("Payroll Layer Contract Pause Controls", () => {
  beforeEach(() => {
    useCompanyWarningsStore.getState().reset();
  });

  describe("Payroll Overview Page (app/payroll/page.tsx)", () => {
    it("renders active mutation actions when contracts are not paused (successful case)", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: false });

      render(<PayrollDashboardPage />);

      expect(screen.queryByTestId("contract-paused-alert")).not.toBeInTheDocument();

      const createBtn = screen.getByTestId("create-batch-action");
      expect(createBtn.tagName).toBe("A");
      expect(createBtn).toHaveAttribute("href", "/payroll/create");
      expect(createBtn).not.toHaveAttribute("aria-disabled");

      const executeBtn = screen.getByTestId("execute-payroll-action");
      expect(executeBtn.tagName).toBe("A");
      expect(executeBtn).toHaveAttribute("href", "/payroll/execute");
    });

    it("disables mutation actions and displays CONTRACT_PAUSED alert when paused (rejected case)", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<PayrollDashboardPage />);

      // Alert banner is present
      const alert = screen.getByTestId("contract-paused-alert");
      expect(alert).toBeInTheDocument();
      expect(screen.getByTestId("error-code-badge")).toHaveTextContent("CONTRACT_PAUSED");

      // Mutation actions are disabled buttons
      const createBtn = screen.getByTestId("create-batch-action");
      expect(createBtn.tagName).toBe("BUTTON");
      expect(createBtn).toHaveAttribute("aria-disabled", "true");
      expect(createBtn).toBeDisabled();

      const executeBtn = screen.getByTestId("execute-payroll-action");
      expect(executeBtn.tagName).toBe("BUTTON");
      expect(executeBtn).toHaveAttribute("aria-disabled", "true");
      expect(executeBtn).toBeDisabled();

      // Read-only link to details remains accessible
      expect(screen.getAllByText(/View Details/i).length).toBeGreaterThan(0);
    });

    it("ensures no private employee salary numbers are rendered in pause banner (boundary / privacy)", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<PayrollDashboardPage />);

      const alert = screen.getByTestId("contract-paused-alert");
      expect(alert.textContent).not.toMatch(/\$\d+|\b\d+\s*(?:USD|USDC|XLM)\b|\bemp_[a-zA-Z0-9_-]+\b/i);
    });
  });

  describe("Payroll Create Page (app/payroll/create/page.tsx)", () => {
    it("allows batch draft submission when contracts are not paused", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: false });

      render(<PayrollCreatePage />);

      const submitBtn = screen.getByTestId("payroll-create-submit");
      expect(submitBtn).not.toBeDisabled();
      expect(screen.queryByTestId("contract-paused-alert")).not.toBeInTheDocument();
    });

    it("disables batch draft submission and rejects mutation when contracts are paused", async () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      render(<PayrollCreatePage />);

      // Banner is shown
      expect(screen.getByTestId("contract-paused-alert")).toBeInTheDocument();

      // Submit button is disabled
      const submitBtn = screen.getByTestId("payroll-create-submit");
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveAttribute("aria-disabled", "true");

      // Triggering submit via form dispatch also rejects safely
      const form = submitBtn.closest("form");
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByTestId("payroll-create-error")).toHaveTextContent(
          /Payroll smart contract operations are currently paused/i
        );
      });
    });
  });
});

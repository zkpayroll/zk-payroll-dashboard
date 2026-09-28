import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PayrollPreflightResultsScreen,
  PreflightCheckItem,
} from "@/components/features/payroll/PayrollPreflightResultsScreen";

describe("PayrollPreflightResultsScreen (#510)", () => {
  it("renders preflight execution screen with readiness score and summary metrics", () => {
    render(
      <PayrollPreflightResultsScreen
        totalAmount={50000}
        employeeCount={10}
        treasuryBalance={120000}
      />
    );

    expect(screen.getByTestId("payroll-preflight-results-screen")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-status-badge")).toHaveTextContent("READY FOR EXECUTION");
    expect(screen.getByTestId("readiness-score-value")).toHaveTextContent("100%");
    expect(screen.getByText("$50,000")).toBeInTheDocument();
    expect(screen.getByText("10 Employees")).toBeInTheDocument();
  });

  it("displays critical blockers and disables execution when blockers exist", () => {
    const mockChecks: PreflightCheckItem[] = [
      {
        id: "check-1",
        title: "Treasury Balance Deficit",
        category: "treasury",
        severity: "blocker",
        description: "Treasury balance ($10,000) is insufficient for payout ($50,000).",
        fixActionLabel: "Top Up Treasury",
      },
      {
        id: "check-2",
        title: "ZK Circuit Ready",
        category: "proof",
        severity: "pass",
        description: "Proof verification valid.",
      },
    ];

    render(<PayrollPreflightResultsScreen checks={mockChecks} />);

    expect(screen.getByTestId("preflight-blockers-section")).toBeInTheDocument();
    expect(screen.getByText("Treasury Balance Deficit")).toBeInTheDocument();
    expect(screen.getByTestId("readiness-status-badge")).toHaveTextContent("BLOCKED — FIX REQUIRED");
    expect(screen.getByTestId("execute-payroll-btn")).toBeDisabled();
  });

  it("calls fix action handler when fix button is clicked on blocker card", async () => {
    const handleFix = vi.fn();
    const mockChecks: PreflightCheckItem[] = [
      {
        id: "check-blocker-wallet",
        title: "Unverified Employee Wallet",
        category: "wallet",
        severity: "blocker",
        description: "Recipient wallet address is unverified.",
        fixActionLabel: "Update Address",
        onFixAction: handleFix,
      },
    ];

    render(<PayrollPreflightResultsScreen checks={mockChecks} />);

    const fixBtn = screen.getByTestId("fix-btn-check-blocker-wallet");
    expect(fixBtn).toBeInTheDocument();

    await userEvent.click(fixBtn);
    expect(handleFix).toHaveBeenCalledTimes(1);
  });

  it("enables execution button when 0 blockers exist and calls onExecutePayroll", async () => {
    const handleExecute = vi.fn();
    render(<PayrollPreflightResultsScreen onExecutePayroll={handleExecute} />);

    const executeBtn = screen.getByTestId("execute-payroll-btn");
    expect(executeBtn).not.toBeDisabled();

    await userEvent.click(executeBtn);
    expect(handleExecute).toHaveBeenCalledTimes(1);
  });

  it("triggers re-run dry run when rerun button is clicked", async () => {
    const handleRerun = vi.fn();
    render(<PayrollPreflightResultsScreen onRerunPreflight={handleRerun} />);

    const rerunBtn = screen.getByTestId("rerun-preflight-btn");
    await userEvent.click(rerunBtn);

    expect(handleRerun).toHaveBeenCalledTimes(1);
  });
});

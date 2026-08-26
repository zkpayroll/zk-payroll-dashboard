import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CompanyStateWarnings from "@/components/features/company/CompanyStateWarnings";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

describe("CompanyStateWarnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCompanyWarningsStore.setState({
      warnings: [],
      companyState: {
        isActive: true,
        isPaused: false,
        isArchived: false,
        setupComplete: true,
        contractsConfigured: true,
        treasuryFunded: true,
        complianceClear: true,
      },
      lastChecked: null,
    });
  });

  it("shows good standing when no warnings", () => {
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company is in good standing")).toBeInTheDocument();
    expect(screen.getByText("No warnings or blocked actions detected")).toBeInTheDocument();
  });

  it("shows warning when company is paused", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company is paused")).toBeInTheDocument();
    expect(screen.getByText(/Payroll actions are suspended/)).toBeInTheDocument();
  });

  it("shows warning when company is archived", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isArchived: true });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company is archived")).toBeInTheDocument();
    expect(screen.getByText(/No payroll actions can be performed/)).toBeInTheDocument();
  });

  it("shows warning when setup is incomplete", () => {
    useCompanyWarningsStore.getState().setCompanyState({ setupComplete: false });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company setup incomplete")).toBeInTheDocument();
    expect(screen.getByText(/required setup steps/)).toBeInTheDocument();
  });

  it("shows warning when contracts not configured", () => {
    useCompanyWarningsStore.getState().setCompanyState({ contractsConfigured: false });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Smart contracts not configured")).toBeInTheDocument();
  });

  it("shows warning when treasury insufficient", () => {
    useCompanyWarningsStore.getState().setCompanyState({ treasuryFunded: false });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Treasury has insufficient funds")).toBeInTheDocument();
  });

  it("shows warning when compliance hold", () => {
    useCompanyWarningsStore.getState().setCompanyState({ complianceClear: false });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Compliance hold active")).toBeInTheDocument();
  });

  it("shows blocking alert for critical issues", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company actions are blocked")).toBeInTheDocument();
    expect(screen.getByText(/Critical issues must be resolved/)).toBeInTheDocument();
  });

  it("dismisses a warning", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    render(<CompanyStateWarnings />);
    const dismissButton = screen.getByLabelText("Dismiss Company is paused");
    fireEvent.click(dismissButton);
    expect(screen.queryByText("Company is paused")).not.toBeInTheDocument();
  });

  it("dismisses all warnings", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true, treasuryFunded: false });
    render(<CompanyStateWarnings />);
    fireEvent.click(screen.getByText("Dismiss all"));
    expect(screen.getByText("Company is in good standing")).toBeInTheDocument();
  });

  it("shows next steps for warnings", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Next steps:")).toBeInTheDocument();
    expect(screen.getByText("Go to Company Settings")).toBeInTheDocument();
    expect(screen.getByText("Click Resume Company")).toBeInTheDocument();
  });

  it("shows blocked actions count", () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    render(<CompanyStateWarnings />);
    expect(screen.getByText(/Blocked:.*action/)).toBeInTheDocument();
  });

  it("shows multiple warnings for multiple blocked conditions", () => {
    useCompanyWarningsStore.getState().setCompanyState({
      isPaused: true,
      treasuryFunded: false,
      complianceClear: false,
    });
    render(<CompanyStateWarnings />);
    expect(screen.getByText("Company Warnings (3)")).toBeInTheDocument();
    expect(screen.getByText("Company is paused")).toBeInTheDocument();
    expect(screen.getByText("Treasury has insufficient funds")).toBeInTheDocument();
    expect(screen.getByText("Compliance hold active")).toBeInTheDocument();
  });
});

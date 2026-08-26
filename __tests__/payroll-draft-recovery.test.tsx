import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import PayrollDraftRecovery from "@/components/features/drafts/PayrollDraftRecovery";
import { usePayrollDraftsStore } from "@/stores/payrollDrafts";
import type { PayrollDraft } from "@/stores/payrollDrafts";

const mockDrafts: PayrollDraft[] = [
  {
    id: "draft_1",
    name: "August Payroll - Engineering",
    employeeIds: ["emp_1", "emp_2", "emp_3"],
    totalAmount: 75000,
    payPeriod: "Aug 2025",
    currency: "USDC",
    status: "draft",
    createdAt: "2025-08-20T10:00:00Z",
    updatedAt: "2025-08-22T14:30:00Z",
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    lastSavedBy: "admin@zkpayroll.io",
  },
  {
    id: "draft_2",
    name: "Contractor Payment - Q3",
    employeeIds: ["emp_4", "emp_5"],
    totalAmount: 25000,
    payPeriod: "Q3 2025",
    currency: "XLM",
    status: "expired",
    createdAt: "2025-08-15T10:00:00Z",
    updatedAt: "2025-08-18T10:00:00Z",
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe("PayrollDraftRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePayrollDraftsStore.setState({
      drafts: mockDrafts,
      activeDraftId: null,
      filterStatus: "all",
      searchQuery: "",
      sortField: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("renders the heading and description", () => {
    render(<PayrollDraftRecovery />);
    expect(screen.getByText("Payroll Drafts")).toBeInTheDocument();
    expect(screen.getByText(/Recover and manage unfinished payroll drafts/)).toBeInTheDocument();
  });

  it("displays draft entries with names and amounts", () => {
    render(<PayrollDraftRecovery />);
    expect(screen.getByText("August Payroll - Engineering")).toBeInTheDocument();
    expect(screen.getByText("Contractor Payment - Q3")).toBeInTheDocument();
    expect(screen.getByText("$75,000")).toBeInTheDocument();
    expect(screen.getByText("$25,000")).toBeInTheDocument();
  });

  it("shows auto-expiration warning banner", () => {
    render(<PayrollDraftRecovery />);
    expect(screen.getByText("Draft auto-expiration")).toBeInTheDocument();
    expect(screen.getByText(/Unfinished drafts expire after 72 hours/)).toBeInTheDocument();
  });

  it("shows active and expired counts", () => {
    render(<PayrollDraftRecovery />);
    expect(screen.getByText("1 active")).toBeInTheDocument();
    expect(screen.getByText("1 expired")).toBeInTheDocument();
  });

  it("renders Recover button for active drafts", () => {
    render(<PayrollDraftRecovery />);
    const recoverButtons = screen.getAllByText("Recover");
    expect(recoverButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls recoverDraft when Recover is clicked", () => {
    const recoverSpy = vi.spyOn(usePayrollDraftsStore.getState(), "recoverDraft");
    render(<PayrollDraftRecovery />);
    const recoverButton = screen.getAllByText("Recover")[0];
    fireEvent.click(recoverButton);
    expect(recoverSpy).toHaveBeenCalledWith("draft_1");
  });

  it("calls discardDraft when trash icon is clicked", () => {
    const discardSpy = vi.spyOn(usePayrollDraftsStore.getState(), "discardDraft");
    render(<PayrollDraftRecovery />);
    const deleteButtons = screen.getAllByTitle("Discard draft");
    fireEvent.click(deleteButtons[0]);
    expect(discardSpy).toHaveBeenCalled();
  });

  it("filters drafts by search query", () => {
    render(<PayrollDraftRecovery />);
    const searchInput = screen.getByPlaceholderText(/Search drafts by name/);
    fireEvent.change(searchInput, { target: { value: "Engineering" } });
    expect(screen.getByText("August Payroll - Engineering")).toBeInTheDocument();
    expect(screen.queryByText("Contractor Payment - Q3")).not.toBeInTheDocument();
  });

  it("filters drafts by status", () => {
    render(<PayrollDraftRecovery />);
    const filterSelect = screen.getByDisplayValue("All Status");
    fireEvent.change(filterSelect, { target: { value: "expired" } });
    expect(screen.getByText("Contractor Payment - Q3")).toBeInTheDocument();
    expect(screen.queryByText("August Payroll - Engineering")).not.toBeInTheDocument();
  });
});

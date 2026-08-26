import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AuditExportWizard from "@/components/features/audit/AuditExportWizard";
import { useAuditExportStore } from "@/stores/auditExport";
import type { AuditPacketEntry } from "@/stores/auditExport";

const mockEntries: AuditPacketEntry[] = [
  {
    id: "entry_1",
    type: "payroll_run",
    title: "August 2025 Payroll",
    date: "2025-08-15T10:00:00Z",
    summary: "Monthly payroll for 50 employees",
    selected: false,
    fields: ["employee_id", "amount", "date"],
  },
  {
    id: "entry_2",
    type: "transaction",
    title: "TX-001 Stellar Transfer",
    date: "2025-08-16T14:00:00Z",
    summary: "Batch transfer of 50,000 USDC",
    selected: false,
    fields: ["tx_hash", "amount", "from", "to"],
  },
  {
    id: "entry_3",
    type: "compliance_event",
    title: "KYC Verification",
    date: "2025-08-17T09:00:00Z",
    summary: "KYC check passed for employee EMP-042",
    selected: true,
    fields: ["employee_id", "status", "timestamp"],
  },
];

describe("AuditExportWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuditExportStore.setState({
      entries: mockEntries,
      currentStep: "select",
      exportFormat: "csv",
      includeMetadata: true,
      dateRangeStart: "",
      dateRangeEnd: "",
      activeExportJob: null,
      exportHistory: [],
    });
  });

  it("renders the heading and description", () => {
    render(<AuditExportWizard />);
    expect(screen.getByText("Audit Packet Export")).toBeInTheDocument();
    expect(screen.getByText(/Review and export audit records/)).toBeInTheDocument();
  });

  it("shows step indicator with Select Records as active", () => {
    render(<AuditExportWizard />);
    expect(screen.getByText("Select Records")).toBeInTheDocument();
  });

  it("displays audit entries for selection", () => {
    render(<AuditExportWizard />);
    expect(screen.getByText("August 2025 Payroll")).toBeInTheDocument();
    expect(screen.getByText("TX-001 Stellar Transfer")).toBeInTheDocument();
    expect(screen.getByText("KYC Verification")).toBeInTheDocument();
  });

  it("shows record count and selected count", () => {
    render(<AuditExportWizard />);
    expect(screen.getByText("3 records available, 1 selected")).toBeInTheDocument();
  });

  it("toggles entry selection", () => {
    render(<AuditExportWizard />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // click first entry checkbox
    expect(screen.getByText("3 records available, 2 selected")).toBeInTheDocument();
  });

  it("selects all entries", () => {
    render(<AuditExportWizard />);
    fireEvent.click(screen.getByText("Select all"));
    expect(screen.getByText("3 records available, 3 selected")).toBeInTheDocument();
  });

  it("deselects all entries", () => {
    render(<AuditExportWizard />);
    fireEvent.click(screen.getByText("Deselect all"));
    expect(screen.getByText("3 records available, 0 selected")).toBeInTheDocument();
  });

  it("disables Next when no entries selected", () => {
    useAuditExportStore.setState({
      entries: mockEntries.map((e) => ({ ...e, selected: false })),
    });
    render(<AuditExportWizard />);
    const nextButton = screen.getByText("Next");
    expect(nextButton.closest("button")).toBeDisabled();
  });

  it("enables Next when entries are selected", () => {
    render(<AuditExportWizard />);
    const nextButton = screen.getByText("Next");
    expect(nextButton.closest("button")).not.toBeDisabled();
  });

  it("searches entries by title", () => {
    render(<AuditExportWizard />);
    const searchInput = screen.getByPlaceholderText(/Search records/);
    fireEvent.change(searchInput, { target: { value: "August" } });
    expect(screen.getByText("August 2025 Payroll")).toBeInTheDocument();
    expect(screen.queryByText("TX-001 Stellar Transfer")).not.toBeInTheDocument();
  });
});

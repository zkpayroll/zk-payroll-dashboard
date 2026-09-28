import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayrollAmendmentHistoryPanel } from "@/components/features/amendments/PayrollAmendmentHistoryPanel";
import { MOCK_AMENDMENTS } from "@/lib/sdk/amendments";

describe("PayrollAmendmentHistoryPanel (#509)", () => {
  it("renders amendment history panel with filters, search, and revision cards", () => {
    render(<PayrollAmendmentHistoryPanel amendments={MOCK_AMENDMENTS} />);

    expect(screen.getByTestId("payroll-amendment-history-panel")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-status-filter")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-history-list")).toBeInTheDocument();

    // Check that revision cards are displayed
    expect(screen.getByText("Employee #1")).toBeInTheDocument();
  });

  it("filters amendments by search query", async () => {
    const user = userEvent.setup();
    render(<PayrollAmendmentHistoryPanel amendments={MOCK_AMENDMENTS} />);

    const searchInput = screen.getByTestId("amendment-search-input");
    await user.type(searchInput, "Employee #4");

    expect(screen.getByText("Employee #4")).toBeInTheDocument();
    expect(screen.queryByText("Employee #2")).not.toBeInTheDocument();
  });

  it("filters amendments by approval status", async () => {
    const user = userEvent.setup();
    render(<PayrollAmendmentHistoryPanel amendments={MOCK_AMENDMENTS} />);

    const statusFilter = screen.getByTestId("amendment-status-filter");
    await user.selectOptions(statusFilter, "blocked");

    expect(screen.getByText("Employee #4")).toBeInTheDocument();
    expect(screen.queryByText("Employee #5")).not.toBeInTheDocument();
  });

  it("opens details drawer when clicking View Details button", async () => {
    const user = userEvent.setup();
    render(<PayrollAmendmentHistoryPanel amendments={MOCK_AMENDMENTS} />);

    const viewDetailsBtn = screen.getByTestId("view-details-btn-amd_valid_001");
    await user.click(viewDetailsBtn);

    expect(screen.getByTestId("amendment-details-drawer")).toBeInTheDocument();
    expect(screen.getByText("Amendment Revision Details")).toBeInTheDocument();
  });

  it("triggers export json and csv callbacks", async () => {
    const user = userEvent.setup();
    const handleExport = vi.fn();
    render(<PayrollAmendmentHistoryPanel onExportHistory={handleExport} />);

    const exportJsonBtn = screen.getByTestId("export-json-btn");
    await user.click(exportJsonBtn);
    expect(handleExport).toHaveBeenCalledWith("json");

    const exportCsvBtn = screen.getByTestId("export-csv-btn");
    await user.click(exportCsvBtn);
    expect(handleExport).toHaveBeenCalledWith("csv");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PayrollArchiveCenter from "@/components/features/archive/PayrollArchiveCenter";
import { useArchiveStore, MOCK_ARCHIVED_RUNS } from "@/stores/archive";

describe("PayrollArchiveCenter", () => {
  beforeEach(() => {
    useArchiveStore.getState().reset();
  });

  it("renders the archive center header and initial runs list", () => {
    render(<PayrollArchiveCenter />);

    expect(screen.getByText("Payroll Run Archive Center")).toBeInTheDocument();
    expect(screen.getByText(/Segregated from Active Operational Payroll/i)).toBeInTheDocument();
    expect(screen.getByText("tx_002")).toBeInTheDocument();
    expect(screen.getByText("tx_001")).toBeInTheDocument();
  });

  it("masks private salary values by default", () => {
    render(<PayrollArchiveCenter />);

    // Private values should be hidden by default
    expect(screen.getByText("Private Values Hidden")).toBeInTheDocument();

    const maskedElements = screen.getAllByText("••••••••");
    expect(maskedElements.length).toBeGreaterThan(0);
  });

  it("toggles private values visibility when clicking the toggle button", () => {
    render(<PayrollArchiveCenter />);

    const toggleButton = screen.getByRole("button", { name: /Private Values Hidden/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText("Private Values Visible")).toBeInTheDocument();
    // After unmasking, dollar amounts like $9,500 should be visible
    expect(screen.getAllByText(/\$9,500/).length).toBeGreaterThan(0);
  });

  it("filters archived runs by search query", () => {
    render(<PayrollArchiveCenter />);

    const searchInput = screen.getByPlaceholderText(
      /Search by run ID, employer, period, asset, or tx hash\.\.\./i
    );

    fireEvent.change(searchInput, { target: { value: "Accra Remote" } });

    expect(screen.getByText("tx_disputed_01")).toBeInTheDocument();
    expect(screen.queryByText("tx_002")).not.toBeInTheDocument();
  });

  it("filters archived runs by pay period", () => {
    render(<PayrollArchiveCenter />);

    const periodSelect = screen.getByLabelText("Filter by pay period");
    fireEvent.change(periodSelect, { target: { value: "2026-07" } });

    expect(screen.getByText("mar_001")).toBeInTheDocument();
    expect(screen.queryByText("tx_001")).not.toBeInTheDocument();
  });

  it("filters archived runs by asset type", () => {
    render(<PayrollArchiveCenter />);

    const assetSelect = screen.getByLabelText("Filter by asset");
    fireEvent.change(assetSelect, { target: { value: "EURC" } });

    expect(screen.getByText("tx_disputed_01")).toBeInTheDocument();
    expect(screen.queryByText("tx_002")).not.toBeInTheDocument();
  });

  it("filters archived runs by employer", () => {
    render(<PayrollArchiveCenter />);

    const employerSelect = screen.getByLabelText("Filter by employer");
    fireEvent.change(employerSelect, { target: { value: "Lagos Payroll Cooperative" } });

    expect(screen.getByText("tx_legacy_05")).toBeInTheDocument();
    expect(screen.queryByText("tx_001")).not.toBeInTheDocument();
  });

  it("filters archived runs by status", () => {
    render(<PayrollArchiveCenter />);

    const statusSelect = screen.getByLabelText("Filter by status");
    fireEvent.change(statusSelect, { target: { value: "disputed" } });

    expect(screen.getByText("tx_disputed_01")).toBeInTheDocument();
    expect(screen.queryByText("tx_002")).not.toBeInTheDocument();
  });

  it("filters archived runs by audit availability", () => {
    render(<PayrollArchiveCenter />);

    const auditSelect = screen.getByLabelText("Filter by audit availability");
    fireEvent.change(auditSelect, { target: { value: "unavailable" } });

    expect(screen.getByText("tx_legacy_05")).toBeInTheDocument();
    expect(screen.queryByText("tx_002")).not.toBeInTheDocument();
  });

  it("displays empty state when no runs match filters and allows clearing filters", () => {
    render(<PayrollArchiveCenter />);

    const searchInput = screen.getByPlaceholderText(
      /Search by run ID, employer, period, asset, or tx hash\.\.\./i
    );
    fireEvent.change(searchInput, { target: { value: "nonexistent_run_query_12345" } });

    expect(screen.getByText("No archived payroll runs match filters")).toBeInTheDocument();

    const clearButtons = screen.getAllByRole("button", { name: /Clear all filters/i });
    expect(clearButtons.length).toBeGreaterThan(0);
    fireEvent.click(clearButtons[0]);

    expect(screen.getByText("tx_002")).toBeInTheDocument();
  });

  it("visibly highlights disputed runs and marks them as not safe to archive", () => {
    render(<PayrollArchiveCenter />);

    // Disputed warning banner should be visible for disputed run
    const disputedRunCard = screen.getByTestId("archive-run-card-arc_004");
    expect(disputedRunCard).toBeInTheDocument();

    expect(within(disputedRunCard).getByText(/Disputed — Not Safe to Archive/i)).toBeInTheDocument();
    expect(within(disputedRunCard).getByText(/Salary commitment mismatch under investigation/i)).toBeInTheDocument();

    // Archive button for disputed run should be disabled
    const disabledArchiveBtn = within(disputedRunCard).getByTestId("archive-button-disabled-arc_004");
    expect(disabledArchiveBtn).toBeDisabled();
    expect(disabledArchiveBtn).toHaveTextContent("Not Safe to Archive");
  });

  it("renders audit packet and receipt links for eligible archived runs", () => {
    render(<PayrollArchiveCenter />);

    const runCard = screen.getByTestId("archive-run-card-arc_001");
    expect(runCard).toBeInTheDocument();

    const auditLink = within(runCard).getByTestId("view-audit-packet-arc_001");
    expect(auditLink).toBeInTheDocument();
    expect(auditLink).toHaveAttribute("href", "/compliance?bundleId=CEB-2025-01-003");

    const receiptLink = within(runCard).getByTestId("view-receipt-arc_001");
    expect(receiptLink).toBeInTheDocument();
    expect(receiptLink).toHaveAttribute("href", "/compliance?tab=receipts&runId=tx_002");
  });

  it("allows unarchiving and archiving non-disputed payroll runs", () => {
    render(<PayrollArchiveCenter />);

    const runCard = screen.getByTestId("archive-run-card-arc_001");
    const archiveBtn = within(runCard).getByTestId("archive-button-arc_001");

    // Initially arc_001 is archived, button says "Unarchive Run"
    expect(archiveBtn).toHaveTextContent("Unarchive Run");

    fireEvent.click(archiveBtn);

    // After clicking, run state updates
    expect(useArchiveStore.getState().runs.find((r) => r.id === "arc_001")?.isArchived).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";

// Mock window.print
window.print = vi.fn();

describe("TransactionHistory & Reconciliation Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders transaction history list with default mock data", () => {
    render(<TransactionHistory />);

    expect(screen.getByText("Transaction History")).toBeInTheDocument();
    // tx_002 is archived; default mode shows only non-archived → 3 transactions
    expect(screen.getByText(/Showing 3 of 3 transactions/i)).toBeInTheDocument();
    expect(screen.getAllByText("Payout").length).toBeGreaterThan(0);
  });

  it("filters transactions by status", async () => {
    render(<TransactionHistory />);

    // Click filter toggle to show filter options
    const filterToggle = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterToggle);

    const statusSelect = screen.getByRole("combobox", { name: /^status$/i });
    expect(statusSelect).toBeInTheDocument();

    // Change status filter to 'pending'
    fireEvent.change(statusSelect, { target: { value: "pending" } });

    // Should only show 1 pending transaction (tx_003, which is not archived)
    expect(screen.getByText(/Showing 1 of 3 transactions/i)).toBeInTheDocument();

    // Change status filter to 'verified'
    fireEvent.change(statusSelect, { target: { value: "verified" } });

    // Should show 1 verified non-archived transaction (tx_001)
    expect(screen.getByText(/Showing 1 of 3 transactions/i)).toBeInTheDocument();

    // Change status filter to 'cancelled'
    fireEvent.change(statusSelect, { target: { value: "cancelled" } });

    // Should show 1 cancelled non-archived transaction (tx_004)
    expect(screen.getByText(/Showing 1 of 3 transactions/i)).toBeInTheDocument();

    // Click clear filters
    const clearButton = screen.getByRole("button", { name: "Clear all" });
    fireEvent.click(clearButton);

    // Should reset back to 3 non-archived transactions
    expect(screen.getByText(/Showing 3 of 3 transactions/i)).toBeInTheDocument();
  });

  it("filters transactions by search query (run ID)", async () => {
    render(<TransactionHistory />);

    const filterToggle = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterToggle);

    const runIdInput = screen.getByPlaceholderText(/Run ID\.\.\./i);
    fireEvent.change(runIdInput, { target: { value: "tx_001" } });

    expect(screen.getByText(/Showing 1 of 3 transactions/i)).toBeInTheDocument();

    // Reset filter
    fireEvent.change(runIdInput, { target: { value: "" } });
    expect(screen.getByText(/Showing 3 of 3 transactions/i)).toBeInTheDocument();
  });

  it("allows saving, applying, renaming, and deleting custom views", async () => {
    render(<TransactionHistory />);

    // Apply a filter first
    const filterToggle = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterToggle);
    const statusSelect = screen.getByRole("combobox", { name: /^status$/i });
    fireEvent.change(statusSelect, { target: { value: "pending" } });

    // Click "Save as view"
    const saveAsViewButton = screen.getByRole("button", { name: /save as view/i });
    fireEvent.click(saveAsViewButton);

    // Input the view name
    const viewNameInput = screen.getByPlaceholderText(/view name\.\.\./i);
    fireEvent.change(viewNameInput, { target: { value: "Pending Runs View" } });

    // Click check to save
    const confirmSaveButton = screen.getByRole("button", { name: /save view/i });
    fireEvent.click(confirmSaveButton);

    // Dropdown view should be saved. Let's toggle the Saved Views dropdown
    const savedViewsDropdown = screen.getByRole("button", { name: /saved views/i });
    fireEvent.click(savedViewsDropdown);

    // Check if the saved view is visible
    expect(screen.getByRole("menuitem", { name: /pending runs view/i })).toBeInTheDocument();

    // Test renaming the view
    const renameButton = screen.getByRole("button", { name: /rename pending runs view/i });
    fireEvent.click(renameButton);

    const renameInput = screen.getByDisplayValue("Pending Runs View");
    fireEvent.change(renameInput, { target: { value: "All Pending View" } });

    const confirmRenameButton = screen.getByRole("button", { name: /save name/i });
    fireEvent.click(confirmRenameButton);

    // Re-verify new name exists
    expect(screen.getByRole("menuitem", { name: /all pending view/i })).toBeInTheDocument();

    // Test deleting the view
    const deleteButton = screen.getByRole("button", { name: /delete all pending view/i });
    fireEvent.click(deleteButton);

    // dropdown should now show no saved views
    expect(screen.getByText(/no saved views yet/i)).toBeInTheDocument();
  });

  it("exports transaction list as a CSV report", async () => {
    // Mock URL and createElement for downloads
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:url");
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    let createdAnchor: HTMLAnchorElement | null = null;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        createdAnchor = el as HTMLAnchorElement;
        vi.spyOn(createdAnchor, "click").mockImplementation(mockClick);
      }
      return el;
    });

    render(<TransactionHistory />);

    const exportButton = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(createdAnchor).not.toBeNull();
      expect(createdAnchor?.download).toMatch(/payroll-history-\d{4}-\d{2}-\d{2}\.csv/);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url");
    });
  });

  it("opens details drawer when details button is clicked", async () => {
    render(<TransactionHistory />);

    // Click details button for tx_001
    const detailButtons = screen.getAllByRole("button", { name: /view details for transaction tx_001/i });
    // There might be both mobile and desktop buttons rendered in the markup, let's click the first one
    fireEvent.click(detailButtons[0]);

    // Check if detail drawer content renders
    expect(screen.getByRole("heading", { name: "Transaction Details" })).toBeInTheDocument();
    expect(screen.getByText("tx_001")).toBeInTheDocument();
  });
});

describe("TransactionHistory – archived mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders only archived payrolls under the archived heading", () => {
    render(<TransactionHistory mode="archived" />);

    expect(screen.getByText("Archived Payrolls")).toBeInTheDocument();
    // tx_002 is the only archived record
    expect(screen.getByText(/Showing 1 of 1 archived payrolls/i)).toBeInTheDocument();
  });

  it("shows the archived-specific empty state when filters yield no results", async () => {
    render(<TransactionHistory mode="archived" />);

    const filterToggle = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterToggle);

    const runIdInput = screen.getByPlaceholderText(/Run ID\.\.\./i);
    fireEvent.change(runIdInput, { target: { value: "tx_999" } });

    expect(
      screen.getAllByText(
        /No transactions match the current filters/i
      )[0]
    ).toBeInTheDocument();
  });
});


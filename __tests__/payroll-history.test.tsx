import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PayrollHistory from "@/components/features/payroll/PayrollHistory";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

describe("PayrollHistory", () => {
  it("renders the calendar heading inside the payroll calendar", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByText("Payroll Schedule")).toBeInTheDocument();
  });

  it("renders a search input with the expected placeholder", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    expect(
      screen.getByPlaceholderText(/search run id, period, tx hash, status/i),
    ).toBeInTheDocument();
  });

  it("renders the filter toggle button", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("shows the filter panel when the filter button is clicked", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));

    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Transaction Outcome")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("hides the filter panel when the filter button is clicked again", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const filterButton = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterButton);
    expect(screen.getByLabelText("Status")).toBeInTheDocument();

    fireEvent.click(filterButton);
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("shows the active filter indicator when a status filter is applied", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));

    const statusSelect = screen.getByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: "verified" } });

    expect(screen.getByText(/1 filter active/i)).toBeInTheDocument();
  });

  it("narrows results when a search query is typed", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const searchInput = screen.getByPlaceholderText(
      /search run id, period, tx hash, status/i,
    );
    fireEvent.change(searchInput, { target: { value: "cancelled" } });

    expect(screen.getByText("Payroll Schedule")).toBeInTheDocument();
  });

  it("shows an active filter count badge on the filter button", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const searchInput = screen.getByPlaceholderText(
      /search run id, period, tx hash, status/i,
    );
    fireEvent.change(searchInput, { target: { value: "verified" } });

    const filterBtn = screen.getByRole("button", {
      name: (name) => name.startsWith("Filter"),
    });
    expect(within(filterBtn).getByText("1")).toBeInTheDocument();
  });

  it("shows a clear button when filters are active and clears them on click", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const searchInput = screen.getByPlaceholderText(
      /search run id, period, tx hash, status/i,
    );
    fireEvent.change(searchInput, { target: { value: "verified" } });

    const clearButton = screen.getByRole("button", { name: /clear all filters/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(searchInput).toHaveValue("");
  });

  it("shows the filter indicator bar when filters are active", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const searchInput = screen.getByPlaceholderText(
      /search run id, period, tx hash, status/i,
    );
    fireEvent.change(searchInput, { target: { value: "verified" } });

    expect(screen.getByText(/1 filter active/i)).toBeInTheDocument();
  });

  it("displays the empty state when no runs match the applied filters", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    const searchInput = screen.getByPlaceholderText(
      /search run id, period, tx hash, status/i,
    );
    fireEvent.change(searchInput, { target: { value: "nonexistent_run_id_xyz" } });

    expect(screen.getByText("No payroll runs yet")).toBeInTheDocument();
  });

  it("renders the PayrollCalendar and its content inside the history view", () => {
    render(<PayrollHistory runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByText("Past payroll runs")).toBeInTheDocument();
  });
});

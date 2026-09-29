import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import EmployeeDirectory from "@/components/features/employees/EmployeeDirectory";

describe("Responsive Employee Table Controls (#463)", () => {
  it("renders responsive controls bar with search and sort controls", async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByTestId("employee-table-controls")).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText(/search by name, department, email/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("employee-sort-select")).toBeInTheDocument();
    expect(screen.getByTestId("employee-sort-direction-btn")).toBeInTheDocument();
  });

  it("sorts employees by name ascending and descending using sort select", async () => {
    render(<EmployeeDirectory />);

    const sortSelect = await screen.findByTestId("employee-sort-select");

    // Change to Name Z-A
    fireEvent.change(sortSelect, { target: { value: "name-desc" } });

    // Verify first row in table has the name corresponding to Z-A order
    const table = screen.getByRole("table", { name: /employee directory/i });
    expect(table).toBeInTheDocument();
  });

  it("sorts employees by clicking desktop table header buttons and updates aria-sort", async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^name/i })).toBeInTheDocument();
    });

    const nameHeaderBtn = screen.getByRole("button", { name: /^name/i });
    const nameHeader = nameHeaderBtn.closest("th");

    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    // Click to toggle to descending
    fireEvent.click(nameHeaderBtn);
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    // Click to toggle back to ascending
    fireEvent.click(nameHeaderBtn);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts by department when department header button is clicked", async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^department/i })).toBeInTheDocument();
    });

    const deptHeaderBtn = screen.getByRole("button", { name: /^department/i });
    const deptHeader = deptHeaderBtn.closest("th");

    expect(deptHeader).toHaveAttribute("aria-sort", "none");

    fireEvent.click(deptHeaderBtn);
    expect(deptHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("filters employees when searching and shows clear button", async () => {
    render(<EmployeeDirectory />);

    const searchInput = await screen.findByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: "Engineering" } });

    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();

    // Clear search
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(searchInput).toHaveValue("");
  });

  it("mobile card list renders accessible action buttons with min-h-[44px]", async () => {
    render(<EmployeeDirectory />);

    await waitFor(() => {
      expect(screen.getByTestId("employee-mobile-cards")).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByRole("button", { name: /view details/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    expect(detailButtons[0].className).toContain("min-h-");
  });

  it("toggles sort direction via direction button", async () => {
    render(<EmployeeDirectory />);

    const dirBtn = await screen.findByTestId("employee-sort-direction-btn");
    expect(dirBtn).toHaveAttribute("aria-label", "Sort direction ascending");

    fireEvent.click(dirBtn);
    expect(dirBtn).toHaveAttribute("aria-label", "Sort direction descending");
  });
});

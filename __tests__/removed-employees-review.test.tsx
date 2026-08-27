import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemovedEmployeesReview } from "@/components/payroll/RemovedEmployeesReview";
import {
  RemovedEmployeeRecord,
  MOCK_DRAFT_REMOVED_EMPLOYEES,
} from "@/lib/payroll/removedEmployees";

const mockRemovedList: RemovedEmployeeRecord[] = [
  {
    id: "emp-101",
    name: "Samantha Reed",
    department: "Product",
    walletAddress: "GB6NV2XV5H44CI5T4QDT6C6L72GIOZ5ZVP65WFFGCL6V5G76H5J72V6J",
    salaryCommitment: "0x1234567890abcdef1234567890abcdef12345678",
    removedAt: "2026-08-27T08:00:00Z",
    removalReason: "Contract hiatus",
    draftStage: true,
  },
  {
    id: "emp-102",
    name: "David Kim",
    department: "Operations",
    walletAddress: "GC7YTR5PQ2L9K4M8N3A6B1C2D3E4F5G6H7I8J9K0",
    salaryCommitment: "0xabcdef1234567890abcdef1234567890abcdef12",
    removedAt: "2026-08-27T08:30:00Z",
    removalReason: "Manual review exclusion",
    draftStage: true,
  },
];

describe("RemovedEmployeesReview Component", () => {
  it("renders draft removal explanation banner and count", () => {
    render(<RemovedEmployeesReview removedEmployees={mockRemovedList} />);

    expect(screen.getByText("Draft Removals Review")).toBeInTheDocument();
    expect(screen.getByText("2 excluded")).toBeInTheDocument();
    expect(
      screen.getByText(/Removals only apply to this draft and can be safely restored before finalizing and locking the payroll batch/i)
    ).toBeInTheDocument();
  });

  it("renders removed employee details with short wallet and redacted salary", () => {
    render(<RemovedEmployeesReview removedEmployees={mockRemovedList} />);

    expect(screen.getByText("Samantha Reed")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Contract hiatus")).toBeInTheDocument();

    expect(screen.getByText("David Kim")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Manual review exclusion")).toBeInTheDocument();

    // Check wallet is shortened
    expect(screen.getByText("GB6NV2…J72V6J")).toBeInTheDocument();

    // Check salary is redacted
    const redactedBadges = screen.getAllByText("[REDACTED]");
    expect(redactedBadges.length).toBe(2);
  });

  it("handles empty removed employees list gracefully", () => {
    render(<RemovedEmployeesReview removedEmployees={[]} />);

    expect(screen.getByTestId("removed-employees-empty")).toBeInTheDocument();
    expect(
      screen.getByText("No employees removed from this draft.")
    ).toBeInTheDocument();
  });

  it("triggers onUndo callback when Restore button is clicked", async () => {
    const user = userEvent.setup();
    const handleUndo = vi.fn();

    render(
      <RemovedEmployeesReview
        removedEmployees={mockRemovedList}
        onUndo={handleUndo}
      />
    );

    const restoreBtn = screen.getByTestId("undo-removal-btn-emp-101");
    await user.click(restoreBtn);

    expect(handleUndo).toHaveBeenCalledWith("emp-101");
    // Row is removed from active removals
    expect(screen.queryByText("Samantha Reed")).not.toBeInTheDocument();
    expect(screen.getByText("David Kim")).toBeInTheDocument();
  });

  it("disables restore button when payroll is locked", () => {
    render(
      <RemovedEmployeesReview
        removedEmployees={mockRemovedList}
        isLocked={true}
      />
    );

    expect(screen.queryByTestId("undo-removal-btn-emp-101")).not.toBeInTheDocument();
    const lockedLabels = screen.getAllByText("Locked");
    expect(lockedLabels.length).toBe(2);
  });

  it("calls onEdit when Edit Draft button is clicked", async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();

    render(
      <RemovedEmployeesReview
        removedEmployees={mockRemovedList}
        onEdit={handleEdit}
      />
    );

    const editBtn = screen.getByRole("button", { name: /Edit Draft/i });
    await user.click(editBtn);

    expect(handleEdit).toHaveBeenCalled();
  });
});

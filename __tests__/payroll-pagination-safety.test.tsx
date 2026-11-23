import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  calculatePaginationSafety,
  MAX_PAGE_SIZE,
} from "@/src/payroll/paginationSafety";
import { PaginationSafetyControls } from "@/components/payroll/PaginationSafetyControls";

describe("Pagination Safety Controls (#520)", () => {
  it("calculates standard pagination boundaries correctly for main path", () => {
    const result = calculatePaginationSafety({
      page: 2,
      pageSize: 20,
      totalItems: 50,
    });

    expect(result.currentPage).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(3);
    expect(result.startIndex).toBe(20);
    expect(result.endIndex).toBe(40);
    expect(result.displayRange).toBe("Showing 21–40 of 50 items");
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.isOverFetchPrevented).toBe(false);
  });

  it("prevents accidental over-fetching by capping page size to MAX_PAGE_SIZE (edge case)", () => {
    const result = calculatePaginationSafety({
      page: 1,
      pageSize: 500, // Excessive page size request
      totalItems: 1000,
    });

    expect(result.pageSize).toBe(MAX_PAGE_SIZE); // Capped at 100
    expect(result.isOverFetchPrevented).toBe(true);
    expect(result.warning).toContain(
      `Requested page size exceeds maximum limit. Capped to ${MAX_PAGE_SIZE} items per page for safety.`
    );
    // Ensure privacy-safe feedback without salary or employee data
    expect(result.warning).not.toMatch(/\$|\b[0-9]{3,}-[0-9]{2,}\b/);
  });

  it("clamps out-of-bounds page requests safely", () => {
    const resultHigh = calculatePaginationSafety({
      page: 999,
      pageSize: 20,
      totalItems: 45,
    });
    expect(resultHigh.currentPage).toBe(3); // 45 / 20 -> 3 pages max
    expect(resultHigh.warning).toContain("Adjusted to page 3");

    const resultLow = calculatePaginationSafety({
      page: -5,
      pageSize: 20,
      totalItems: 45,
    });
    expect(resultLow.currentPage).toBe(1);
  });

  it("handles empty item lists gracefully", () => {
    const result = calculatePaginationSafety({
      page: 1,
      pageSize: 20,
      totalItems: 0,
    });

    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.displayRange).toBe("Showing 0 of 0 items");
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(false);
  });

  it("renders PaginationSafetyControls component and handles page transitions", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <PaginationSafetyControls
        currentPage={1}
        pageSize={20}
        totalItems={50}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByText("Showing 1–20 of 50 items")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

"use client";

import React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { calculatePaginationSafety } from "@/src/payroll/paginationSafety";

export interface PaginationSafetyControlsProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function PaginationSafetyControls({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
}: PaginationSafetyControlsProps) {
  const safety = calculatePaginationSafety({
    page: currentPage,
    pageSize,
    totalItems,
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {safety.warning && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-xs font-medium text-amber-800 border border-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{safety.warning}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-sm text-gray-700">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-600" aria-live="polite">
            {safety.displayRange}
          </span>

          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <label htmlFor="payroll-page-size" className="text-xs text-gray-500">
                Rows per page:
              </label>
              <select
                id="payroll-page-size"
                value={safety.pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(safety.currentPage - 1)}
            disabled={!safety.hasPreviousPage}
            aria-label="Previous page"
            className="flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-3 text-xs font-medium text-gray-600">
            Page {safety.currentPage} of {safety.totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(safety.currentPage + 1)}
            disabled={!safety.hasNextPage}
            aria-label="Next page"
            className="flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginationSafetyControls;

export const MIN_PAGE_SIZE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE = 1;

export interface PaginationSafetyOptions {
  page?: number;
  pageSize?: number;
  totalItems: number;
}

export interface PaginationSafetyResult {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  displayRange: string;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  warning: string | null;
  isOverFetchPrevented: boolean;
}

/**
 * Validates pagination inputs, clamps page sizes to prevent over-fetching,
 * and calculates privacy-safe boundary information for payroll lists.
 */
export function calculatePaginationSafety(
  options: PaginationSafetyOptions
): PaginationSafetyResult {
  const { totalItems } = options;
  const rawPageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const rawPage = options.page ?? DEFAULT_PAGE;

  let warning: string | null = null;
  let isOverFetchPrevented = false;

  // 1. Clamp page size to protect against over-fetching
  let pageSize = Math.floor(Number(rawPageSize));
  if (isNaN(pageSize) || pageSize < MIN_PAGE_SIZE) {
    pageSize = DEFAULT_PAGE_SIZE;
  } else if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
    isOverFetchPrevented = true;
    warning = `Requested page size exceeds maximum limit. Capped to ${MAX_PAGE_SIZE} items per page for safety.`;
  }

  // 2. Calculate total pages
  const safeTotalItems = Math.max(0, Math.floor(Number(totalItems) || 0));
  const totalPages = safeTotalItems === 0 ? 1 : Math.ceil(safeTotalItems / pageSize);

  // 3. Clamp page number within valid boundaries
  let currentPage = Math.floor(Number(rawPage));
  if (isNaN(currentPage) || currentPage < 1) {
    currentPage = 1;
    if (rawPage < 1) {
      warning = warning || "Page number must be 1 or greater. Reset to page 1.";
    }
  } else if (currentPage > totalPages) {
    currentPage = totalPages;
    warning = warning || `Requested page exceeds available records. Adjusted to page ${totalPages}.`;
  }

  // 4. Calculate indices and range boundary text
  let startIndex = 0;
  let endIndex = 0;
  let displayRange = "Showing 0 of 0 items";

  if (safeTotalItems > 0) {
    startIndex = (currentPage - 1) * pageSize;
    endIndex = Math.min(startIndex + pageSize, safeTotalItems);
    displayRange = `Showing ${startIndex + 1}–${endIndex} of ${safeTotalItems} items`;
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: safeTotalItems,
    startIndex,
    endIndex,
    displayRange,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    warning,
    isOverFetchPrevented,
  };
}

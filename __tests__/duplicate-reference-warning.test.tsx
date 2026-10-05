/**
 * Employee onboarding duplicate reference-id warning (issue #431).
 *
 * Covers:
 *  - the pure grouping helper: distinct input, duplicates, blank ids, ordering
 *  - the warning panel: renders what it must, renders nothing when clean
 *  - the CSV onboarding flow: duplicates warn, clean input does not, and a
 *    file without the optional column behaves exactly as before
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DuplicateReferenceWarning from "@/components/employees/DuplicateReferenceWarning";
import { findDuplicateReferenceIds } from "@/lib/validation/duplicateReferenceId";
import CsvImport from "@/components/features/employees/CsvImport";
import { useEmployeeStore } from "@/stores/employees";

// Toasts are fire-and-forget here; asserting on them would couple this suite
// to presentation rather than to the warning itself.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const ADDRESS = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

function csvWithReferenceIds(ids: string[]): string {
  const header = "name,address,salary,start_date,employee_id";
  const rows = ids.map(
    (id, index) =>
      `Employee ${index + 1},${ADDRESS},5000,2025-06-01,${id}`,
  );
  return [header, ...rows].join("\n");
}

function csvWithoutReferenceColumn(): string {
  const header = "name,address,salary,start_date";
  const rows = [
    `Alice,${ADDRESS},5000,2025-06-01`,
    `Bob,${ADDRESS},5000,2025-06-01`,
  ];
  return [header, ...rows].join("\n");
}

function selectCsv(container: HTMLElement, contents: string): void {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="file"]',
  );
  if (!input) throw new Error("file input not rendered");

  const file = new File([contents], "employees.csv", { type: "text/csv" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

// ─── Helper ────────────────────────────────────────────────────────────────

describe("findDuplicateReferenceIds", () => {
  it("returns nothing when every reference id is distinct", () => {
    expect(
      findDuplicateReferenceIds([
        { rowIndex: 1, referenceId: "EMP-1" },
        { rowIndex: 2, referenceId: "EMP-2" },
      ]),
    ).toEqual([]);
  });

  it("treats blank and missing reference ids as non-duplicates", () => {
    expect(
      findDuplicateReferenceIds([
        { rowIndex: 1, referenceId: "" },
        { rowIndex: 2, referenceId: "   " },
        { rowIndex: 3 },
        { rowIndex: 4, referenceId: null },
      ]),
    ).toEqual([]);

    // Two blanks are still not a duplicate of each other.
    expect(
      findDuplicateReferenceIds([
        { rowIndex: 1, referenceId: "" },
        { rowIndex: 2, referenceId: "" },
      ]),
    ).toEqual([]);
  });

  it("groups a repeated reference id with its row indexes, trimming whitespace", () => {
    expect(
      findDuplicateReferenceIds([
        { rowIndex: 1, referenceId: "EMP-001" },
        { rowIndex: 2, referenceId: "EMP-002" },
        { rowIndex: 3, referenceId: "  EMP-001 " },
      ]),
    ).toEqual([{ referenceId: "EMP-001", rowIndexes: [1, 3] }]);
  });

  it("reports independent groups in first-seen order", () => {
    const groups = findDuplicateReferenceIds([
      { rowIndex: 1, referenceId: "B" },
      { rowIndex: 2, referenceId: "A" },
      { rowIndex: 3, referenceId: "B" },
      { rowIndex: 4, referenceId: "A" },
    ]);

    expect(groups.map((group) => group.referenceId)).toEqual(["B", "A"]);
    expect(groups[0].rowIndexes).toEqual([1, 3]);
    expect(groups[1].rowIndexes).toEqual([2, 4]);
  });
});

// ─── Panel ─────────────────────────────────────────────────────────────────

describe("DuplicateReferenceWarning", () => {
  it("renders nothing when there are no duplicates", () => {
    const { container } = render(<DuplicateReferenceWarning duplicates={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("names the duplicated reference id and the rows carrying it", () => {
    render(
      <DuplicateReferenceWarning
        duplicates={[{ referenceId: "EMP-001", rowIndexes: [1, 3] }]}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("EMP-001")).toBeInTheDocument();
    expect(screen.getByText("— 2 rows: 1, 3")).toBeInTheDocument();
  });
});

// ─── Onboarding flow ───────────────────────────────────────────────────────

describe("CSV onboarding duplicate reference warning", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useEmployeeStore.getState().setEmployees([]);
    vi.clearAllMocks();
  });

  it("warns when the input repeats a reference id", async () => {
    const { container } = render(<CsvImport />);

    selectCsv(
      container,
      csvWithReferenceIds(["EMP-001", "EMP-002", "EMP-001"]),
    );

    expect(await screen.findByText("EMP-001")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("— 2 rows: 1, 3")).toBeInTheDocument();
    // The distinct id is not part of the warning.
    expect(screen.queryByText("EMP-002")).not.toBeInTheDocument();
  });

  it("stays silent when every reference id is distinct", async () => {
    const { container } = render(<CsvImport />);

    selectCsv(container, csvWithReferenceIds(["EMP-001", "EMP-002"]));

    expect(
      await screen.findByText("Parsed Records"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/duplicate employee reference/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays silent for files that predate the optional column", async () => {
    const { container } = render(<CsvImport />);

    selectCsv(container, csvWithoutReferenceColumn());

    expect(
      await screen.findByText("Parsed Records"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/duplicate employee reference/i),
    ).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CsvImport from "@/components/features/employees/CsvImport";
import {
  ImportSalaryCommitmentDuplicateWarning,
  type DuplicateCommitmentResolution,
} from "@/components/features/employees/ImportSalaryCommitmentDuplicateWarning";
import { findDuplicateSalaryCommitments } from "@/src/payroll/importSalaryCommitmentDuplicates";
import type { SalaryCommitmentDuplicateGroup } from "@/src/payroll/importSalaryCommitmentDuplicates";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const ADDRESS_A =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const ADDRESS_B =
  "GAC2P5KQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

const DUPLICATE_CSV = [
  "name,email,department,address,salary,start_date",
  `Jane Doe,jane@company.io,Engineering,${ADDRESS_A},5000,2025-06-01`,
  `John Doe,john@company.io,Engineering,${ADDRESS_A},5000,2025-06-01`,
  `Ada Lovelace,ada@company.io,Product,${ADDRESS_B},7000,2025-06-01`,
].join("\n");

const CLEAN_CSV = [
  "name,email,department,address,salary,start_date",
  `Jane Doe,jane@company.io,Engineering,${ADDRESS_A},5000,2025-06-01`,
  `Ada Lovelace,ada@company.io,Product,${ADDRESS_B},7000,2025-06-01`,
].join("\n");

async function uploadCsv(container: HTMLElement, csv: string) {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File([csv], "employees.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ImportSalaryCommitmentDuplicateWarning component", () => {
  const groups = findDuplicateSalaryCommitments([
    { rowIndex: 1, address: ADDRESS_A, salary: "5000", name: "Jane Doe" },
    { rowIndex: 2, address: ADDRESS_A, salary: "5000", name: "John Doe" },
  ]);

  it("renders nothing when the import holds no duplicate", () => {
    const { container } = render(
      <ImportSalaryCommitmentDuplicateWarning groups={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("highlights the duplicate group with a masked wallet address", () => {
    render(<ImportSalaryCommitmentDuplicateWarning groups={groups} />);

    const panel = screen.getByTestId(
      "import-salary-commitment-duplicate-warning",
    );
    expect(panel).toBeInTheDocument();
    expect(
      screen.getByText(/1 duplicate salary commitment detected/i),
    ).toBeInTheDocument();
    expect(panel.textContent).toContain("GDQP2K…4W37");
    expect(panel.textContent).toContain("Row 1");
    expect(panel.textContent).toContain("Row 2");
  });

  it("reports the chosen keeper row to the caller", () => {
    const onResolve = vi.fn<
      (
        group: SalaryCommitmentDuplicateGroup,
        resolution: DuplicateCommitmentResolution,
      ) => void
    >();
    render(
      <ImportSalaryCommitmentDuplicateWarning
        groups={groups}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Row 1/ }));

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][1]).toBe(1);
  });

  it("allows the operator to exclude every row of a group", () => {
    const onResolve = vi.fn<
      (
        group: SalaryCommitmentDuplicateGroup,
        resolution: DuplicateCommitmentResolution,
      ) => void
    >();
    render(
      <ImportSalaryCommitmentDuplicateWarning
        groups={groups}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /exclude every row in this group/i }),
    );

    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][1]).toBe("skip");
  });

  it("never renders a raw salary amount or a full wallet address (privacy)", () => {
    render(<ImportSalaryCommitmentDuplicateWarning groups={groups} />);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/5000/);
    expect(text).not.toContain(ADDRESS_A);
  });
});

describe("CsvImport duplicate salary commitment highlighting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not warn when the imported file holds no duplicate (success case)", async () => {
    const { container } = render(<CsvImport />);

    await uploadCsv(container, CLEAN_CSV);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /import all valid/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("import-salary-commitment-duplicate-warning"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /import all valid \(2\)/i }),
    ).toBeEnabled();
  });

  it("highlights duplicate rows and blocks the import until they are resolved (rejected case)", async () => {
    const { container } = render(<CsvImport />);

    await uploadCsv(container, DUPLICATE_CSV);

    await waitFor(() =>
      expect(
        screen.getByTestId("import-salary-commitment-duplicate-warning"),
      ).toBeInTheDocument(),
    );

    // Both duplicated rows are marked, the clean row is not.
    expect(screen.getByTestId("csv-import-duplicate-badge-1")).toBeInTheDocument();
    expect(screen.getByTestId("csv-import-duplicate-badge-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("csv-import-duplicate-badge-3"),
    ).not.toBeInTheDocument();

    // The import is blocked while the duplicate is unresolved.
    const importAll = screen.getByRole("button", {
      name: /import all valid/i,
    });
    expect(importAll).toBeDisabled();

    // Per-row import of a duplicated row is blocked as well.
    expect(screen.getAllByText(/resolve duplicate/i)).toHaveLength(2);
  });

  it("allows the import once a single row is kept for the duplicate group (boundary case)", async () => {
    const { container } = render(<CsvImport />);

    await uploadCsv(container, DUPLICATE_CSV);

    await waitFor(() =>
      expect(
        screen.getByTestId("import-salary-commitment-duplicate-warning"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("radio", { name: /Row 1/ }));

    await waitFor(() => {
      const importAll = screen.getByRole("button", {
        name: /import all valid/i,
      });
      expect(importAll).toBeEnabled();
      // The excluded row no longer counts towards the import.
      expect(importAll.textContent).toContain("Import all valid (2)");
    });

    expect(
      screen.getByTestId("csv-import-duplicate-badge-2").textContent,
    ).toMatch(/excluded/i);
  });

  it("excludes every row of a group when the operator skips the group", async () => {
    const { container } = render(<CsvImport />);

    await uploadCsv(container, DUPLICATE_CSV);

    await waitFor(() =>
      expect(
        screen.getByTestId("import-salary-commitment-duplicate-warning"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /exclude every row in this group/i }),
    );

    await waitFor(() => {
      const importAll = screen.getByRole("button", {
        name: /import all valid/i,
      });
      expect(importAll).toBeEnabled();
      expect(importAll.textContent).toContain("Import all valid (1)");
    });
  });

  it("never renders the duplicated salary amount in the preview (privacy)", async () => {
    const { container } = render(<CsvImport />);

    await uploadCsv(container, DUPLICATE_CSV);

    await waitFor(() =>
      expect(
        screen.getByTestId("import-salary-commitment-duplicate-warning"),
      ).toBeInTheDocument(),
    );

    const panel = screen.getByTestId(
      "import-salary-commitment-duplicate-warning",
    );
    expect(panel.textContent).not.toMatch(/5000/);
    expect(panel.textContent).not.toContain(ADDRESS_A);
  });
});

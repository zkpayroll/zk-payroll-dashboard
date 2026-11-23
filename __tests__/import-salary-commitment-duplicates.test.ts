import { describe, expect, it } from "vitest";
import {
  evaluateDuplicateSalaryCommitments,
  findDuplicateSalaryCommitments,
  hasDuplicateSalaryCommitments,
  maskCommitmentValue,
  normalizeImportSalary,
  type SalaryCommitmentImportRow,
} from "@/src/payroll/importSalaryCommitmentDuplicates";

const ADDRESS_A =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const ADDRESS_B =
  "GAC2P5KQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

function row(
  rowIndex: number,
  address: string,
  salary: number | string,
  extra: Partial<SalaryCommitmentImportRow> = {},
): SalaryCommitmentImportRow {
  return { rowIndex, address, salary, ...extra };
}

describe("normalizeImportSalary", () => {
  it("normalizes numeric strings and numbers", () => {
    expect(normalizeImportSalary("5000")).toBe(5000);
    expect(normalizeImportSalary("  5000  ")).toBe(5000);
    expect(normalizeImportSalary("5000.50")).toBe(5000.5);
    expect(normalizeImportSalary(5000)).toBe(5000);
  });

  it("rejects values that cannot become a positive amount", () => {
    expect(normalizeImportSalary("")).toBeNull();
    expect(normalizeImportSalary("   ")).toBeNull();
    expect(normalizeImportSalary("abc")).toBeNull();
    expect(normalizeImportSalary("0")).toBeNull();
    expect(normalizeImportSalary("-100")).toBeNull();
    expect(normalizeImportSalary(null)).toBeNull();
    expect(normalizeImportSalary(undefined)).toBeNull();
    expect(normalizeImportSalary(Number.NaN)).toBeNull();
  });
});

describe("findDuplicateSalaryCommitments", () => {
  it("returns no duplicate when every row commits a distinct salary to a distinct wallet (success case)", () => {
    const rows = [
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_B, "5000"),
      row(3, ADDRESS_A, "7000"),
    ];

    const groups = findDuplicateSalaryCommitments(rows);

    expect(groups).toHaveLength(0);
    expect(hasDuplicateSalaryCommitments(rows)).toBe(false);
  });

  it("blocks an import where two rows commit the same salary to the same wallet (rejected case)", () => {
    const rows = [
      row(1, ADDRESS_A, "5000", { name: "Jane Doe" }),
      row(2, ADDRESS_A, "5000", { name: "John Doe" }),
    ];

    const groups = findDuplicateSalaryCommitments(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("duplicate_salary_commitment");
    expect(groups[0].isBlocking).toBe(true);
    expect(groups[0].rowIndexes).toEqual([1, 2]);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].actionableRemediation).toMatch(/keep a single row/i);
  });

  it("keeps the same salary on different wallets out of scope (boundary case)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_B, "5000"),
    ]);

    expect(groups).toHaveLength(0);
  });

  it("keeps the same wallet with different salaries out of scope (boundary case)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_A, "7000"),
    ]);

    expect(groups).toHaveLength(0);
  });

  it("does not flag a single row (boundary case)", () => {
    expect(findDuplicateSalaryCommitments([row(1, ADDRESS_A, "5000")])).toEqual(
      [],
    );
  });

  it("treats the same amount written differently as the same commitment (boundary case)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_A, "5000.00"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].rowIndexes).toEqual([1, 2]);
  });

  it("ignores rows whose salary cannot be normalized (boundary case)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "not-a-number"),
      row(2, ADDRESS_A, "not-a-number"),
      row(3, ADDRESS_A, ""),
    ]);

    expect(groups).toHaveLength(0);
  });

  it("groups only the duplicated rows when a file mixes duplicates with clean rows", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_B, "5000"),
      row(3, ADDRESS_A, "5000"),
      row(4, ADDRESS_B, "9000"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].rowIndexes).toEqual([1, 3]);
  });

  it("detects rows carrying the exact same commitment value", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000", {
        salaryCommitment: "0x8fae32bc5694a10d9e223bf091234acfe7659102",
      }),
      row(2, ADDRESS_B, "9000", {
        salaryCommitment: "0x8fae32bc5694a10d9e223bf091234acfe7659102",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("identical_commitment_value");
    expect(groups[0].isBlocking).toBe(true);
    expect(groups[0].commitment).toBe("0x8fae32bc…9102");
    expect(groups[0].rowIndexes).toEqual([1, 2]);
  });

  it("does not flag distinct commitment values", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000", { salaryCommitment: "0xaaa" }),
      row(2, ADDRESS_B, "9000", { salaryCommitment: "0xbbb" }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it("never exposes a raw salary amount or a full wallet address (privacy)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "123456"),
      row(2, ADDRESS_A, "123456"),
    ]);

    const serialized = JSON.stringify(groups);
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain(ADDRESS_A);
    expect(groups[0].address).toBe("GDQP2K…4W37");
    expect(groups[0].message).not.toMatch(/\d{3,}/);
  });

  it("does not leak the salary through the group identifier (privacy)", () => {
    const groups = findDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "123456"),
      row(2, ADDRESS_A, "123456"),
    ]);

    expect(groups[0].id).not.toContain("123456");
  });
});

describe("evaluateDuplicateSalaryCommitments", () => {
  it("reports a clean import (success case)", () => {
    const report = evaluateDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_B, "5000"),
    ]);

    expect(report.isDuplicate).toBe(false);
    expect(report.isBlocking).toBe(false);
    expect(report.groups).toHaveLength(0);
    expect(report.affectedRowIndexes).toEqual([]);
    expect(report.summary).toMatch(/no duplicate salary commitments/i);
  });

  it("blocks an import that contains a duplicate commitment (rejected case)", () => {
    const report = evaluateDuplicateSalaryCommitments([
      row(1, ADDRESS_A, "5000"),
      row(2, ADDRESS_A, "5000"),
      row(3, ADDRESS_B, "7000"),
    ]);

    expect(report.isDuplicate).toBe(true);
    expect(report.isBlocking).toBe(true);
    expect(report.affectedRowIndexes).toEqual([1, 2]);
    expect(report.summary).toMatch(/must be resolved before importing/i);
    expect(report.summary).not.toMatch(/5000/);
  });

  it("ignores malformed input instead of throwing (boundary case)", () => {
    const report = evaluateDuplicateSalaryCommitments(
      undefined as unknown as SalaryCommitmentImportRow[],
    );

    expect(report.isDuplicate).toBe(false);
    expect(report.groups).toEqual([]);
  });
});

describe("maskCommitmentValue", () => {
  it("truncates long commitment values and keeps short ones intact", () => {
    expect(
      maskCommitmentValue("0x8fae32bc5694a10d9e223bf091234acfe7659102"),
    ).toBe("0x8fae32bc…9102");
    expect(maskCommitmentValue("0xabc")).toBe("0xabc");
    expect(maskCommitmentValue(null)).toBe("");
  });
});

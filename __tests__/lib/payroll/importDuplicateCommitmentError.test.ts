import { describe, expect, it } from "vitest";
import {
  findDuplicateCommitments,
  checkDuplicateCommitments,
  normalizeSalaryAmount,
  normalizeAddress,
  maskAddress,
  formatDuplicateCommitmentError,
  getAllDuplicateErrors,
  type CommitmentRecord,
} from "@/lib/payroll/importDuplicateCommitmentError";

const ADDRESS_A = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const ADDRESS_B = "GAC2P5KQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

const mockRecord = (
  rowIndex: number,
  address: string,
  amount: number,
): CommitmentRecord => ({
  rowIndex,
  recipientAddress: address,
  salaryAmount: amount,
});

describe("importDuplicateCommitmentError", () => {
  describe("normalizeSalaryAmount", () => {
    it("converts valid numeric strings", () => {
      expect(normalizeSalaryAmount("5000")).toBe(5000);
      expect(normalizeSalaryAmount("5000.50")).toBe(5000.5);
      expect(normalizeSalaryAmount("  5000  ")).toBe(5000);
    });

    it("accepts valid numbers", () => {
      expect(normalizeSalaryAmount(5000)).toBe(5000);
      expect(normalizeSalaryAmount(5000.5)).toBe(5000.5);
    });

    it("rejects invalid amounts", () => {
      expect(normalizeSalaryAmount("abc")).toBeNull();
      expect(normalizeSalaryAmount("0")).toBeNull();
      expect(normalizeSalaryAmount("-100")).toBeNull();
      expect(normalizeSalaryAmount("")).toBeNull();
      expect(normalizeSalaryAmount(Number.NaN)).toBeNull();
    });
  });

  describe("normalizeAddress", () => {
    it("trims and uppercases addresses", () => {
      expect(normalizeAddress("  " + ADDRESS_A + "  ")).toBe(
        ADDRESS_A.toUpperCase(),
      );
      expect(normalizeAddress(ADDRESS_A.toLowerCase())).toBe(
        ADDRESS_A.toUpperCase(),
      );
    });
  });

  describe("maskAddress", () => {
    it("masks full addresses showing first and last 4 chars", () => {
      const masked = maskAddress(ADDRESS_A);
      expect(masked).toMatch(/^GDQP\.\.\.[W37]{3}$/);
    });

    it("returns masked placeholder for short addresses", () => {
      expect(maskAddress("short")).toBe("***");
      expect(maskAddress("")).toBe("***");
    });
  });

  describe("findDuplicateCommitments", () => {
    it("detects no duplicates when all commitments are unique", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_B, 5000),
        mockRecord(3, ADDRESS_A, 7000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(0);
    });

    it("detects duplicate salary commitments to the same address", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(1);
      expect(groups[0].recipientAddress).toBe(ADDRESS_A.toUpperCase());
      expect(groups[0].salaryAmount).toBe(5000);
      expect(groups[0].affectedRows).toEqual([1, 2]);
      expect(groups[0].occurrences).toBe(2);
    });

    it("detects multiple duplicate groups", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
        mockRecord(3, ADDRESS_B, 7000),
        mockRecord(4, ADDRESS_B, 7000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(2);
    });

    it("detects triple duplicates", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
        mockRecord(3, ADDRESS_A, 5000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(1);
      expect(groups[0].occurrences).toBe(3);
    });

    it("ignores case and whitespace in addresses", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A.toLowerCase(), 5000),
        mockRecord(3, "  " + ADDRESS_A + "  ", 5000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(1);
      expect(groups[0].affectedRows).toEqual([1, 2, 3]);
    });

    it("distinguishes duplicates from same address with different amounts", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
        mockRecord(3, ADDRESS_A, 7000),
      ];

      const groups = findDuplicateCommitments(records);
      expect(groups).toHaveLength(1);
      expect(groups[0].affectedRows).toEqual([1, 2]);
    });
  });

  describe("checkDuplicateCommitments", () => {
    it("returns success when no duplicates found", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_B, 5000),
      ];

      const result = checkDuplicateCommitments(records);
      expect(result.hasDuplicates).toBe(false);
      expect(result.isBlocking).toBe(false);
      expect(result.errorCount).toBe(0);
    });

    it("returns blocking error when duplicates found", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
      ];

      const result = checkDuplicateCommitments(records);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);
      expect(result.errorCount).toBe(1);
      expect(result.message).toMatch(/duplicate/i);
    });

    it("counts errors correctly for multiple duplicates", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
        mockRecord(3, ADDRESS_A, 5000),
      ];

      const result = checkDuplicateCommitments(records);
      expect(result.errorCount).toBe(2);
    });

    it("masks recipient addresses in error message", () => {
      const records = [
        mockRecord(1, ADDRESS_A, 5000),
        mockRecord(2, ADDRESS_A, 5000),
      ];

      const result = checkDuplicateCommitments(records);
      expect(result.message).not.toContain(ADDRESS_A.substring(5, 20));
      expect(result.message).toMatch(/\.\.\./);
    });
  });

  describe("formatDuplicateCommitmentError", () => {
    it("formats error message with masked address", () => {
      const group = {
        recipientAddress: ADDRESS_A,
        salaryAmount: 5000,
        affectedRows: [1, 2],
        occurrences: 2,
      };

      const error = formatDuplicateCommitmentError(group);
      expect(error).toMatch(/identical salary commitments/i);
      expect(error).toMatch(/rows 1, 2/);
      expect(error).not.toContain(ADDRESS_A.substring(5, 20));
    });
  });

  describe("getAllDuplicateErrors", () => {
    it("generates formatted error strings for all groups", () => {
      const groups = [
        {
          recipientAddress: ADDRESS_A,
          salaryAmount: 5000,
          affectedRows: [1, 2],
          occurrences: 2,
        },
        {
          recipientAddress: ADDRESS_B,
          salaryAmount: 7000,
          affectedRows: [3, 4],
          occurrences: 2,
        },
      ];

      const errors = getAllDuplicateErrors(groups);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatch(/identical salary commitments/i);
      expect(errors[1]).toMatch(/identical salary commitments/i);
    });
  });
});

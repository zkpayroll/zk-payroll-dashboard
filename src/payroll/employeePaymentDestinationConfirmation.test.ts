import { describe, it, expect } from "vitest";
import {
  evaluateDestinationConfirmation,
  validateBatchDestinationConfirmations,
  type EmployeeDestinationRecord,
} from "./employeePaymentDestinationConfirmation";

const VALID_ADDRESS = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const VALID_CONFIRMED_AT = "2026-01-15T10:00:00.000Z";
const VALID_UPDATED_AT = "2026-01-14T09:00:00.000Z";

const confirmedRecord: EmployeeDestinationRecord = {
  employeeId: "emp-001",
  walletAddress: VALID_ADDRESS,
  confirmedAt: VALID_CONFIRMED_AT,
  updatedAt: VALID_UPDATED_AT,
};

describe("evaluateDestinationConfirmation", () => {
  it("returns confirmed for a fully valid record", () => {
    const result = evaluateDestinationConfirmation(confirmedRecord);
    expect(result.status).toBe("confirmed");
    expect(result.error).toBeNull();
  });

  it("returns pending when confirmedAt is null", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      confirmedAt: null,
    });
    expect(result.status).toBe("pending");
    expect(result.error).toMatch(/not been confirmed/i);
  });

  it("returns stale when wallet was updated after confirmation", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      confirmedAt: "2026-01-10T08:00:00.000Z",
      updatedAt: "2026-01-12T08:00:00.000Z",
    });
    expect(result.status).toBe("stale");
    expect(result.error).toMatch(/re-confirmation required/i);
  });

  it("returns missing when walletAddress is empty", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      walletAddress: "",
    });
    expect(result.status).toBe("missing");
    expect(result.error).toMatch(/valid Stellar wallet address/i);
  });

  it("returns missing when walletAddress is not a valid Stellar address", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      walletAddress: "not-a-real-address",
    });
    expect(result.status).toBe("missing");
  });

  it("returns missing when employeeId is empty", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      employeeId: "   ",
    });
    expect(result.status).toBe("missing");
    expect(result.error).toMatch(/Employee ID is required/i);
  });

  it("returns confirmed when updatedAt is null (no update history)", () => {
    const result = evaluateDestinationConfirmation({
      ...confirmedRecord,
      updatedAt: null,
    });
    expect(result.status).toBe("confirmed");
    expect(result.error).toBeNull();
  });
});

describe("validateBatchDestinationConfirmations", () => {
  it("returns canProceed true when all records are confirmed", () => {
    const result = validateBatchDestinationConfirmations([confirmedRecord]);
    expect(result.canProceed).toBe(true);
    expect(result.confirmedCount).toBe(1);
    expect(result.blockerMessage).toBeNull();
  });

  it("returns canProceed false when any record is pending", () => {
    const pending: EmployeeDestinationRecord = {
      ...confirmedRecord,
      employeeId: "emp-002",
      confirmedAt: null,
    };
    const result = validateBatchDestinationConfirmations([confirmedRecord, pending]);
    expect(result.canProceed).toBe(false);
    expect(result.pendingCount).toBe(1);
    expect(result.confirmedCount).toBe(1);
    expect(result.blockerMessage).toMatch(/1 employee destination/i);
  });

  it("counts stale and missing records correctly", () => {
    const stale: EmployeeDestinationRecord = {
      ...confirmedRecord,
      employeeId: "emp-003",
      confirmedAt: "2026-01-10T08:00:00.000Z",
      updatedAt: "2026-01-12T08:00:00.000Z",
    };
    const missing: EmployeeDestinationRecord = {
      ...confirmedRecord,
      employeeId: "emp-004",
      walletAddress: "",
    };
    const result = validateBatchDestinationConfirmations([stale, missing]);
    expect(result.staleCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.canProceed).toBe(false);
  });

  it("returns canProceed false with a blocker message for an empty batch", () => {
    const result = validateBatchDestinationConfirmations([]);
    expect(result.canProceed).toBe(false);
    expect(result.blockerMessage).toMatch(/No employee records/i);
    expect(result.totalEmployees).toBe(0);
  });
});

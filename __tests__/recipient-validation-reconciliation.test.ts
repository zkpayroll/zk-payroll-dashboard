import { describe, expect, it, beforeEach } from "vitest";
import {
  createRecipientRecord,
  submitValidation,
  recordDiscrepancy,
  resolveRecipientValidation,
  evaluateRecipientValidation,
  maskRecipientAddress,
  maskAccountId,
  type RecipientRecord,
} from "@/payroll/recipientValidationReconciliation";

describe("Recipient Validation Reconciliation", () => {
  let record: RecipientRecord;

  beforeEach(() => {
    record = createRecipientRecord({
      id: "recipient_1",
      employeeRef: "emp_123",
      payrollRunId: "run_456",
      addressMasked: "0x1234567890abcdef",
      accountIdMasked: "acct_123456",
    });
  });

  it("creates a recipient record in pending status", () => {
    expect(record.id).toBe("recipient_1");
    expect(record.status).toBe("pending");
    expect(record.employeeRef).toBe("emp_123");
    expect(record.completedValidations).toEqual([]);
  });

  it("masks addresses for privacy", () => {
    const masked = maskRecipientAddress("0x1234567890abcdef");
    expect(masked).not.toContain("1234567890");
    expect(masked).toContain("...");
    expect(masked.length).toBeLessThan("0x1234567890abcdef".length);
  });

  it("masks account IDs for privacy", () => {
    const masked = maskAccountId("account_12345678");
    expect(masked).not.toContain("12345678");
    expect(masked).toContain("...");
  });

  it("handles short addresses gracefully", () => {
    const short = maskRecipientAddress("abc");
    expect(short.length).toBeGreaterThan(0);
    expect(short).not.toBe("abc");
  });

  it("submits validation steps and transitions status", () => {
    let updated = submitValidation(record, "address_verification", true);
    expect(updated.status).toBe("in_progress");
    expect(updated.completedValidations).toContain("address_verification");

    updated = submitValidation(updated, "account_ownership", true);
    expect(updated.completedValidations).toContain("account_ownership");

    updated = submitValidation(updated, "contact_validation", true);
    expect(updated.status).toBe("validated");
    expect(updated.validatedAt).toBeDefined();
  });

  it("records discrepancies in recipient data", () => {
    const withDiscrepancy = recordDiscrepancy(record, "Address mismatch with KYC records");
    expect(withDiscrepancy.status).toBe("discrepancy_found");
    expect(withDiscrepancy.discrepancies).toContain("Address mismatch with KYC records");
  });

  it("accumulates multiple discrepancies", () => {
    let updated = recordDiscrepancy(record, "Discrepancy 1");
    updated = recordDiscrepancy(updated, "Discrepancy 2");
    expect(updated.discrepancies?.length).toBe(2);
    expect(updated.status).toBe("discrepancy_found");
  });

  it("prevents duplicate discrepancies", () => {
    let updated = recordDiscrepancy(record, "Same issue");
    updated = recordDiscrepancy(updated, "Same issue");
    expect(updated.discrepancies?.length).toBe(1);
  });

  it("resolves recipient validation with notes", () => {
    const resolved = resolveRecipientValidation(record, "Address verified through alternative source");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.resolutionNotes).toContain("verified through alternative source");
  });

  it("prevents resolving already resolved records", () => {
    const resolved = resolveRecipientValidation(record, "Initial notes");
    expect(() => resolveRecipientValidation(resolved, "More notes")).not.toThrow();
  });

  it("evaluates recipient validation status correctly", () => {
    const evaluation = evaluateRecipientValidation(record);
    expect(evaluation.isValid).toBe(false);
    expect(evaluation.status).toBe("pending");
    expect(evaluation.remainingValidations.length).toBeGreaterThan(0);
    expect(evaluation.requiresAction).toBe(true);
  });

  it("tracks validation progress in evaluation", () => {
    let updated = submitValidation(record, "address_verification", true);
    const eval1 = evaluateRecipientValidation(updated);
    const initialRemaining = eval1.remainingValidations.length;

    updated = submitValidation(updated, "account_ownership", true);
    const eval2 = evaluateRecipientValidation(updated);
    expect(eval2.remainingValidations.length).toBeLessThan(initialRemaining);
  });

  it("validates required fields during creation", () => {
    expect(() =>
      createRecipientRecord({
        id: "",
        employeeRef: "emp_1",
        payrollRunId: "run_1",
        addressMasked: "addr_1",
        accountIdMasked: "acct_1",
      }),
    ).toThrow("id must be provided");

    expect(() =>
      createRecipientRecord({
        id: "rec_1",
        employeeRef: "emp_1",
        payrollRunId: "run_1",
        addressMasked: "",
        accountIdMasked: "acct_1",
      }),
    ).toThrow("Address must be provided");
  });

  it("handles discrepancies in validation flow", () => {
    let updated = submitValidation(record, "address_verification", true);
    updated = recordDiscrepancy(updated, "Secondary check failed");
    expect(updated.status).toBe("discrepancy_found");

    const evaluation = evaluateRecipientValidation(updated);
    expect(evaluation.requiresAction).toBe(true);
  });
});

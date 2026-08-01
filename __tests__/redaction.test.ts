import { describe, it, expect } from "vitest";
import {
  redactEvent,
  redactPayload,
  hashEmployeeId,
  isSensitiveKey,
  sanitizeErrorMessage,
} from "@/src/observability/redaction";
import type { PayrollEvent } from "@/src/observability/types";

describe("Redaction Security Rules", () => {
  it("detects sensitive field key patterns correctly", () => {
    expect(isSensitiveKey("salary")).toBe(true);
    expect(isSensitiveKey("totalAmount")).toBe(true);
    expect(isSensitiveKey("employeeId")).toBe(true);
    expect(isSensitiveKey("ssn")).toBe(true);
    expect(isSensitiveKey("privateInputs")).toBe(true);
    expect(isSensitiveKey("secretKey")).toBe(true);
    expect(isSensitiveKey("seedPhrase")).toBe(true);

    expect(isSensitiveKey("durationMs")).toBe(false);
    expect(isSensitiveKey("errorCategory")).toBe(false);
    expect(isSensitiveKey("network")).toBe(false);
  });

  it("redacts every known sensitive field type from payloads", () => {
    const rawPayload = {
      salary: 5000,
      totalAmount: 150000,
      employeeId: "emp_12345",
      ssn: "000-12-3456",
      employeeName: "Jane Doe",
      privateInputs: "0xdeadbeef",
      secretKey: "SXXXXXXX12345",
      seedPhrase: "apple banana cherry",
      durationMs: 120, // Non-sensitive allowed field
      errorCategory: "user_rejected", // Non-sensitive allowed field
    };

    const redacted = redactPayload(rawPayload);

    expect(redacted.salary).toBe("[REDACTED]");
    expect(redacted.totalAmount).toBe("[REDACTED]");
    expect(redacted.employeeId).toBe("[REDACTED]");
    expect(redacted.ssn).toBe("[REDACTED]");
    expect(redacted.employeeName).toBe("[REDACTED]");
    expect(redacted.privateInputs).toBe("[REDACTED]");
    expect(redacted.secretKey).toBe("[REDACTED]");
    expect(redacted.seedPhrase).toBe("[REDACTED]");

    expect(redacted.durationMs).toBe(120);
    expect(redacted.errorCategory).toBe("user_rejected");
  });

  it("strips unclassified/unknown fields by default (fail-safe default test)", () => {
    const rawPayload = {
      network: "testnet", // Known allowed
      unclassifiedCustomField: "some_value", // Unclassified unknown field
      unclassifiedCustomMetric: 42, // Unclassified unknown field
    };

    const redacted = redactPayload(rawPayload);

    expect(redacted.network).toBe("testnet");
    expect(redacted.unclassifiedCustomField).toBe("[REDACTED_UNCLASSIFIED]");
    expect(redacted.unclassifiedCustomMetric).toBe("[REDACTED_UNCLASSIFIED]");
  });

  it("produces stable, non-reversible employee reference hashes", () => {
    const empId1 = "emp_998877";
    const hash1 = hashEmployeeId(empId1);
    const hash2 = hashEmployeeId(empId1);
    const hash3 = hashEmployeeId("emp_000000");

    expect(hash1).toMatch(/^emp_ref_[a-f0-9]+$/);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).not.toContain(empId1);
  });

  it("sanitizes inline sensitive values in error messages", () => {
    const rawMsg = "Failed processing payment of 500 XLM for user@example.com with SSN 123-45-6789";
    const sanitized = sanitizeErrorMessage(rawMsg);

    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("500 XLM");
    expect(sanitized).not.toContain("123-45-6789");
    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized).toContain("[REDACTED_AMOUNT]");
    expect(sanitized).toContain("[REDACTED_SSN]");
  });

  it("redactEvent central choke point applies redaction to full event structure", () => {
    const event: PayrollEvent = {
      id: "evt_1",
      correlationId: "pay_run_123",
      sequence: 1,
      timestamp: "2026-07-29T16:00:00.000Z",
      stage: "draft",
      status: "succeeded",
      payload: {
        totalAmount: 9000,
        network: "pubnet",
        unknownProp: "test",
      },
    };

    const cleanEvent = redactEvent(event);

    expect(cleanEvent.id).toBe("evt_1");
    expect(cleanEvent.correlationId).toBe("pay_run_123");
    expect(cleanEvent.payload.totalAmount).toBe("[REDACTED]");
    expect(cleanEvent.payload.network).toBe("pubnet");
    expect(cleanEvent.payload.unknownProp).toBe("[REDACTED_UNCLASSIFIED]");
  });
});

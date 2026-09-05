import { describe, it, expect, beforeEach } from "vitest";
import {
  inspectPayload,
  buildCopySafeSummary,
} from "@/lib/privacy/inspector";
import { redactPayload, resetEmployeeCounter } from "@/lib/privacy/redact";

// ── Redaction tests ─────────────────────────────────────────────────────────

describe("Payload Redaction", () => {
  beforeEach(() => {
    resetEmployeeCounter();
  });

  it("redacts employee names with numbered placeholders", () => {
    const payload = {
      employeeName: "Alice Johnson",
      name: "Bob Smith",
    };
    const { data, redactedFields } = redactPayload(payload);

    expect(data.employeeName).toBe("[Employee #1]");
    expect(data.name).toBe("[Employee #2]");
    expect(redactedFields).toHaveLength(2);
    expect(redactedFields[0].originalType).toBe("name");
  });

  it("redacts salary and amount fields", () => {
    const payload = {
      salary: 75000,
      totalAmount: 150000,
      amount: 5000,
    };
    const { data, redactedFields } = redactPayload(payload);

    expect(data.salary).toBe("[REDACTED]");
    expect(data.totalAmount).toBe("[REDACTED]");
    expect(data.amount).toBe("[REDACTED]");
    expect(redactedFields).toHaveLength(3);
    expect(redactedFields.every((f) => f.originalType === "amount")).toBe(true);
  });

  it("redacts memo and comment fields", () => {
    const payload = {
      memo: "Confidential payroll note",
      comment: "Approved by CFO",
    };
    const { data } = redactPayload(payload);

    expect(data.memo).toBe("[REDACTED]");
    expect(data.comment).toBe("[REDACTED]");
  });

  it("redacts secret fields (SSN, salt, private keys)", () => {
    const payload = {
      ssn: "123-45-6789",
      salt: "random_salt_value",
      privateKey: "SABC123",
      nullifier: "nf_abc",
    };
    const { data } = redactPayload(payload);

    expect(data.ssn).toBe("[REDACTED]");
    expect(data.salt).toBe("[REDACTED]");
    expect(data.privateKey).toBe("[REDACTED]");
    expect(data.nullifier).toBe("[REDACTED]");
  });

  it("preserves safe public fields", () => {
    const payload = {
      id: "payroll_001",
      companyId: "comp_abc",
      network: "TESTNET",
      status: "pending",
      employeeCount: 10,
      txHash: "abc123def456",
    };
    const { data, redactedFields } = redactPayload(payload);

    expect(data.id).toBe("payroll_001");
    expect(data.companyId).toBe("comp_abc");
    expect(data.network).toBe("TESTNET");
    expect(data.status).toBe("pending");
    expect(data.employeeCount).toBe(10);
    expect(data.txHash).toBe("abc123def456");
    expect(redactedFields).toHaveLength(0);
  });

  it("handles nested objects", () => {
    const payload = {
      id: "run_001",
      asset: {
        code: "USDC",
        issuer: "GA123",
      },
      employee: {
        name: "Charlie",
        salary: 80000,
      },
    };
    const { data } = redactPayload(payload);

    expect(data.id).toBe("run_001");
    const asset = data.asset as Record<string, unknown>;
    expect(asset.code).toBe("USDC");
    const employee = data.employee as Record<string, unknown>;
    expect(employee.name).toBe("[Employee #1]");
    expect(employee.salary).toBe("[REDACTED]");
  });

  it("handles arrays of objects", () => {
    const payload = {
      employees: [
        { name: "Alice", salary: 50000 },
        { name: "Bob", salary: 60000 },
      ],
    };
    const { data } = redactPayload(payload);
    const employees = data.employees as Record<string, unknown>[];

    expect(employees[0].name).toBe("[Employee #1]");
    expect(employees[0].salary).toBe("[REDACTED]");
    expect(employees[1].name).toBe("[Employee #2]");
    expect(employees[1].salary).toBe("[REDACTED]");
  });

  it("redacts unknown keys by default (fail-safe)", () => {
    const payload = {
      id: "run_001",
      someCustomField: "secret_value",
    };
    const { data } = redactPayload(payload);

    expect(data.id).toBe("run_001");
    expect(data.someCustomField).toBe("[REDACTED]");
  });
});

// ── Inspector tests ─────────────────────────────────────────────────────────

describe("Payload Inspector", () => {
  beforeEach(() => {
    resetEmployeeCounter();
  });

  it("detects a payroll run payload", () => {
    const payload = {
      id: "run_001",
      companyId: "comp_abc",
      status: "pending",
      approvalStatus: "pending_executive_approval",
      totalAmount: 150000,
      employeeCount: 10,
      employeeIds: ["emp_1", "emp_2"],
      proof: "0xproof_abc",
      createdAt: "2026-01-15T10:00:00Z",
    };

    const summary = inspectPayload(payload);

    expect(summary.title).toBe("Payroll Run");
    expect(summary.isRecognized).toBe(true);
    expect(summary.sections.length).toBeGreaterThan(0);
    expect(summary.redactedFieldCount).toBeGreaterThan(0);
  });

  it("detects a multi-asset run payload", () => {
    const payload = {
      id: "ma_run_001",
      label: "January Payroll",
      companyId: "comp_abc",
      status: "ready",
      totalEmployees: 20,
      assetGroups: [
        { asset: { code: "USDC" }, totalAmount: 100000, transactionCount: 10, status: "funded" },
        { asset: { code: "XLM" }, totalAmount: 50000, transactionCount: 5, status: "pending" },
      ],
    };

    const summary = inspectPayload(payload);

    expect(summary.title).toBe("Multi-Asset Payroll Run");
    expect(summary.isRecognized).toBe(true);
    // Should have overview + 2 asset sections
    expect(summary.sections.length).toBeGreaterThanOrEqual(3);
  });

  it("detects a Soroban contract call payload", () => {
    const payload = {
      contractId: "CA123ABC",
      method: "execute_payroll",
      args: ["arg1", "arg2"],
    };

    const summary = inspectPayload(payload);

    expect(summary.title).toBe("Soroban Contract Call");
    expect(summary.isRecognized).toBe(true);
  });

  it("detects a proof verification payload", () => {
    const payload = {
      merkleRoot: "0xmerkle_abc",
      totalPayrollAmount: "150000",
      payrollPeriodId: "period_2026_01",
      publicSignals: ["signal1", "signal2"],
    };

    const summary = inspectPayload(payload);

    expect(summary.title).toBe("ZK Proof Verification");
    expect(summary.isRecognized).toBe(true);
  });

  it("marks unknown payloads with a warning", () => {
    const payload = {
      foo: "bar",
      baz: 42,
    };

    const summary = inspectPayload(payload);

    expect(summary.title).toBe("Unknown Payload");
    expect(summary.isRecognized).toBe(false);
    expect(summary.warnings.some((w) => w.includes("not recognized"))).toBe(true);
  });

  it("generates a warning for failed status", () => {
    const payload = {
      id: "run_001",
      status: "failed",
      employeeIds: ["emp_1"],
    };

    const summary = inspectPayload(payload);

    expect(summary.warnings.some((w) => w.includes("failed"))).toBe(true);
  });

  it("generates a warning for rejected approval status", () => {
    const payload = {
      id: "run_001",
      approvalStatus: "rejected",
      employeeIds: ["emp_1"],
    };

    const summary = inspectPayload(payload);

    expect(summary.warnings.some((w) => w.includes("rejected"))).toBe(true);
  });

  it("generates a warning for correction_requested status", () => {
    const payload = {
      id: "run_001",
      approvalStatus: "correction_requested",
      employeeIds: ["emp_1"],
    };

    const summary = inspectPayload(payload);

    expect(summary.warnings.some((w) => w.includes("Corrections"))).toBe(true);
  });

  it("counts redacted fields correctly", () => {
    const payload = {
      id: "run_001",
      totalAmount: 100000,
      employeeName: "Alice",
      memo: "secret note",
      status: "pending",
    };

    const summary = inspectPayload(payload);

    // totalAmount, employeeName, memo = 3 redacted; id, status = safe
    expect(summary.redactedFieldCount).toBe(3);
  });

  it("showPrivate option skips redaction", () => {
    const payload = {
      id: "run_001",
      totalAmount: 100000,
      employeeName: "Alice",
      employeeIds: ["emp_1"],
      status: "pending",
    };

    const summary = inspectPayload(payload, { showPrivate: true });

    expect(summary.redactedFieldCount).toBe(0);
    // The amount section should show the real value
    const disbursement = summary.sections.find((s) => s.title === "Disbursement");
    expect(disbursement).toBeDefined();
    const amountField = disbursement!.fields.find((f) => f.label === "Total Amount");
    expect(amountField!.value).toBe("100,000");
  });
});

// ── Copy-safe summary tests ─────────────────────────────────────────────────

describe("Copy-Safe Summary", () => {
  beforeEach(() => {
    resetEmployeeCounter();
  });

  it("produces a plain-text summary with redacted fields", () => {
    const payload = {
      id: "run_001",
      companyId: "comp_abc",
      totalAmount: 150000,
      employeeIds: ["emp_1"],
      status: "pending",
    };

    const text = buildCopySafeSummary(payload);

    expect(text).toContain("Payroll Run");
    expect(text).toContain("run_001");
    expect(text).toContain("comp_abc");
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("150000");
    expect(text).toContain("Redacted fields:");
    expect(text).toContain("Generated:");
  });

  it("always redacts even if called directly (copy-safe invariant)", () => {
    const payload = {
      employeeName: "Sensitive Name",
      salary: 99999,
    };

    const text = buildCopySafeSummary(payload);

    expect(text).not.toContain("Sensitive Name");
    expect(text).not.toContain("99999");
  });

  it("includes warnings in the output", () => {
    const payload = {
      foo: "bar",
    };

    const text = buildCopySafeSummary(payload);

    expect(text).toContain("not recognized");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_ERROR_CONTEXT_RULES,
  PrivacySafeErrorContextError,
  assertPrivacySafeErrorContext,
  filterErrorContext,
} from "@/src/errors/privacySafeErrorContext";

describe("filterErrorContext", () => {
  it("returns an empty context unchanged for a contributor audience", () => {
    const result = filterErrorContext({}, { audience: "contributor" });

    expect(result.filtered).toEqual({});
    expect(result.redactedFields).toEqual([]);
    expect(result.retainedFields).toEqual([]);
    expect(result.isPrivacySafe).toBe(true);
    expect(result.audience).toBe("contributor");
  });

  it("redacts auditor-only fields for a contributor audience", () => {
    const result = filterErrorContext(
      { salary: 100000, salaryCommitment: "0xabc123", message: "failed" },
      { audience: "contributor" },
    );

    expect(result.filtered.salary).toBe("[redacted]");
    expect(result.filtered.salaryCommitment).toBe("••••");
    expect(result.filtered.message).toBe("failed");
    expect(result.redactedFields).toContain("salary");
    expect(result.redactedFields).toContain("salaryCommitment");
    expect(result.retainedFields).toContain("message");
    expect(result.isPrivacySafe).toBe(false);
  });

  it("masks wallet address for maintainer but not auditor", () => {
    const maintainer = filterErrorContext(
      { address: "GDQP2K…4W37", employeeId: "emp_001" },
      { audience: "maintainer" },
    );
    expect(maintainer.filtered.address).toBe("[redacted]");
    expect(maintainer.filtered.employeeId).toBe("••••");
    expect(maintainer.isPrivacySafe).toBe(false);

    const auditor = filterErrorContext(
      { address: "GDQP2K...4W37", employeeId: "emp_001" },
      { audience: "auditor" },
    );
    expect(auditor.filtered.address).toBe("GDQP2K...4W37");
    expect(auditor.filtered.employeeId).toBe("emp_001");
    expect(auditor.isPrivacySafe).toBe(true);
  });

  it("applies explicit field rules over defaults", () => {
    const result = filterErrorContext(
      { payoutDestination: "GAJBC123" },
      {
        audience: "contributor",
        rules: [{ field: "payoutDestination", sensitivity: "public" }],
      },
    );

    expect(result.filtered.payoutDestination).toBe("GAJBC123");
    expect(result.redactedFields).not.toContain("payoutDestination");
    expect(result.isPrivacySafe).toBe(true);
  });

  it("filters nested context paths", () => {
    const result = filterErrorContext(
      { payload: { salary: 50000, employeeId: "emp_002" }, note: "retry" },
      { audience: "contributor" },
    );

    expect(result.filtered.payload.salary).toBe("[redacted]");
    expect(result.filtered.payload.employeeId).toBe("••••");
    expect(result.filtered.note).toBe("retry");
    expect(result.redactedFields).toContain("payload.salary");
    expect(result.redactedFields).toContain("payload.employeeId");
    expect(result.retainedFields).toContain("note");
  });

  it("filters array entries by field path", () => {
    const result = filterErrorContext(
      { employees: [{ employeeId: "emp_003", name: "Ada" }, { employeeId: "emp_004" }] },
      { audience: "contributor" },
    );

    expect(result.filtered.employees[0].employeeId).toBe("••••");
    expect(result.filtered.employees[0].name).toBe("••••");
    expect(result.redactedFields).toContain("employees[0].employeeId");
    expect(result.redactedFields).toContain("employees[0].name");
  });

  it("returns non-object context unchanged", () => {
    expect(filterErrorContext("just a string", { audience: "contributor" }).filtered).toEqual({});
    expect(filterErrorContext(null, { audience: "contributor" }).filtered).toEqual({});
    expect(filterErrorContext(42, { audience: "contributor" }).filtered).toEqual({});
  });
});

describe("DEFAULT_ERROR_CONTEXT_RULES", () => {
  it("covers salary, wallet, and identity fields", () => {
    const fields = DEFAULT_ERROR_CONTEXT_RULES.map((rule) => rule.field);
    expect(fields).toContain("salary");
    expect(fields).toContain("salaryCommitment");
    expect(fields).toContain("address");
    expect(fields).toContain("walletAddress");
    expect(fields).toContain("employeeId");
    expect(fields).toContain("name");
    expect(fields).toContain("email");
  });
});

describe("assertPrivacySafeErrorContext", () => {
  it("returns the result when the context is privacy-safe", () => {
    const result = assertPrivacySafeErrorContext(
      { message: "retry", code: "network" },
      { audience: "contributor" },
    );

    expect(result.isPrivacySafe).toBe(true);
    expect(result.filtered.message).toBe("retry");
  });

  it("throws a typed error carrying the result when not privacy-safe", () => {
    let thrown: unknown;
    try {
      assertPrivacySafeErrorContext(
        { salary: 99999, employeeId: "emp_005" },
        { audience: "contributor" },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PrivacySafeErrorContextError);
    const error = thrown as PrivacySafeErrorContextError;
    expect(error.name).toBe("PrivacySafeErrorContextError");
    expect(error.result.redactedFields).toContain("salary");
    expect(error.result.redactedFields).toContain("employeeId");
    expect(error.message).toContain("not safe for contributor audience");
  });
});

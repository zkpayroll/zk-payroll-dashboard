import { describe, test, expect } from "vitest";
import { evaluateRevisionProtection } from "../lib/payroll/revisionProtection";
import type { PayrollRun } from "@/types/models";

describe("Payroll Revision Protection", () => {
  test("allows revision for pending drafts", () => {
    const payroll: Pick<PayrollRun, "approvalStatus" | "status"> = {
      approvalStatus: "draft",
      status: "pending",
    };
    const result = evaluateRevisionProtection(payroll);
    expect(result.canRevise).toBe(true);
  });

  test("blocks revision for approved payrolls", () => {
    const payroll: Pick<PayrollRun, "approvalStatus" | "status"> = {
      approvalStatus: "approved",
      status: "pending",
    };
    const result = evaluateRevisionProtection(payroll);
    expect(result.canRevise).toBe(false);
    expect(result.reason).toContain("already been approved");
    expect(result.remediation).toContain("cancel this payroll");
  });

  test("blocks revision for cancelled payrolls", () => {
    const payroll: Pick<PayrollRun, "approvalStatus" | "status"> = {
      approvalStatus: "rejected",
      status: "cancelled",
    };
    const result = evaluateRevisionProtection(payroll);
    expect(result.canRevise).toBe(false);
    expect(result.reason).toContain("cancelled");
  });

  test("blocks revision when payroll is missing", () => {
    const result = evaluateRevisionProtection(null);
    expect(result.canRevise).toBe(false);
    expect(result.reason).toContain("not found");
  });
});

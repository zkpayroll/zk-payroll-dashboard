import { describe, it, expect } from "vitest";
import { diagnoseBlockedExecution } from "@/lib/sdk/blockedExecutionDiagnostics";
import { validateReportInput } from "./blocked-execution-diagnostics-panel-helpers";

describe("BlockedExecutionDiagnosticsPanel helpers", () => {
  it("diagnoses a clean run as executable", () => {
    const report = diagnoseBlockedExecution({
      runId: "run_panel_001",
      totalAmount: 1000,
      employeeCount: 2,
      employeeIds: ["emp_1", "emp_2"],
      proofStatus: "success",
      hasProof: true,
      treasuryBalance: 5000,
      approvalStatus: "approved",
    });
    expect(report.canExecute).toBe(true);
    expect(validateReportInput(report)).toBeNull();
  });

  it("flags invalid report shapes with actionable errors", () => {
    expect(validateReportInput(null as never)).toMatch(/required/i);
    expect(
      validateReportInput({ canExecute: "yes" } as never)
    ).toMatch(/invalid execution flags/i);
  });

  it("detects blocked execution edge case (cancelled + executed)", () => {
    const report = diagnoseBlockedExecution({
      runId: "run_panel_002",
      totalAmount: 1000,
      employeeCount: 1,
      employeeIds: ["emp_1"],
      proofStatus: "success",
      hasProof: true,
      treasuryBalance: 5000,
      approvalStatus: "approved",
      isAlreadyExecuted: true,
      isCancelled: true,
    });
    expect(report.isBlocked).toBe(true);
    expect(report.blockerCount).toBe(2);
  });
});

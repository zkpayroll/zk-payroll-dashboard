import { describe, expect, it, beforeEach } from "vitest";
import {
  createOutlierPayment,
  flagOutlierPayment,
  submitInvestigationStep,
  evaluateOutlierPayment,
  DEFAULT_OUTLIER_POLICY,
  type OutlierPayment,
} from "@/payroll/outlierPaymentInvestigationWorkflow";

describe("Outlier Payment Investigation Workflow", () => {
  let payment: OutlierPayment;

  beforeEach(() => {
    payment = createOutlierPayment({
      id: "outlier_1",
      payrollRunId: "run_123",
      employeeRef: "emp_456",
      deviationPercent: 35,
    });
  });

  it("creates an outlier payment in detected status", () => {
    expect(payment.id).toBe("outlier_1");
    expect(payment.status).toBe("detected");
    expect(payment.deviationPercent).toBe(35);
    expect(payment.completedSteps).toEqual([]);
  });

  it("validates required fields during creation", () => {
    expect(() => createOutlierPayment({ id: "", payrollRunId: "run_1", employeeRef: "emp_1", deviationPercent: 10 })).toThrow("id must be provided");
    expect(() => createOutlierPayment({ id: "id_1", payrollRunId: "", employeeRef: "emp_1", deviationPercent: 10 })).toThrow("Payroll run id");
    expect(() => createOutlierPayment({ id: "id_1", payrollRunId: "run_1", employeeRef: "", deviationPercent: 10 })).toThrow("Employee reference");
  });

  it("submits investigation steps and transitions status", () => {
    let updated = submitInvestigationStep(payment, "initial_review", "op_1");
    expect(updated.status).toBe("under_investigation");
    expect(updated.completedSteps).toContain("initial_review");

    updated = submitInvestigationStep(updated, "pattern_analysis", "op_1");
    expect(updated.completedSteps).toContain("pattern_analysis");

    updated = submitInvestigationStep(updated, "operator_verification", "op_2");
    expect(updated.completedSteps).toContain("operator_verification");

    updated = submitInvestigationStep(updated, "resolution_approval", "op_2");
    expect(updated.status).toBe("cleared");
    expect(updated.resolvedAt).toBeDefined();
  });

  it("flags outlier for escalated review", () => {
    const flagged = flagOutlierPayment(payment, "Unusual amount for this employee", "op_1");
    expect(flagged.status).toBe("flagged");
    expect(flagged.investigationNotes).toContain("Unusual amount");
    expect(flagged.resolutionReason).toBe("escalated_for_review");
  });

  it("prevents adding steps to resolved payments", () => {
    const resolved = flagOutlierPayment(payment, "Review required", "op_1");
    expect(() => submitInvestigationStep(resolved, "initial_review", "op_1")).toThrow("Cannot add investigation step");
  });

  it("evaluates outlier payment status correctly", () => {
    const evaluation = evaluateOutlierPayment(payment);
    expect(evaluation.isOutlier).toBe(true);
    expect(evaluation.status).toBe("detected");
    expect(evaluation.missingSteps.length).toBeGreaterThan(0);
    expect(evaluation.requiresApproval).toBe(true);
  });

  it("tracks investigation progress in evaluation", () => {
    let updated = submitInvestigationStep(payment, "initial_review", "op_1");
    let eval1 = evaluateOutlierPayment(updated);
    const step1MissingCount = eval1.missingSteps.length;

    updated = submitInvestigationStep(updated, "pattern_analysis", "op_1");
    const eval2 = evaluateOutlierPayment(updated);
    expect(eval2.missingSteps.length).toBeLessThan(step1MissingCount);
  });

  it("respects custom policy thresholds", () => {
    const lowDeviation = createOutlierPayment({
      id: "outlier_2",
      payrollRunId: "run_123",
      employeeRef: "emp_789",
      deviationPercent: 15,
      policy: { deviationThresholdPercent: 20 },
    });

    const eval = evaluateOutlierPayment(lowDeviation, { ...DEFAULT_OUTLIER_POLICY, deviationThresholdPercent: 20 });
    expect(eval.isOutlier).toBe(false);
  });
});

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  compilePayrollPolicy,
} from "@/lib/sdk/payrollPolicyCompiler";
import {
  usePayrollPolicyStore,
  DEFAULT_PAYROLL_POLICY,
} from "@/stores/payrollPolicy";
import PayrollPolicyEditor from "@/components/features/policy/PayrollPolicyEditor";
import type { PayrollPolicy } from "@/types/policy";

describe("SDK Payroll Policy Compiler", () => {
  let samplePolicy: PayrollPolicy;

  beforeEach(() => {
    samplePolicy = JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY));
  });

  it("compiles a valid policy with zero blocking errors", () => {
    const result = compilePayrollPolicy(samplePolicy);
    expect(result.isValid).toBe(true);
    expect(result.summary.errorsCount).toBe(0);
    expect(result.compiledDigest).toMatch(/^pol_0x[a-f0-9]{8}$/);
    expect(result.impactPreview.riskRating).toBe("low");
  });

  it("produces warnings when non-critical security controls are relaxed", () => {
    // Single approver and lower reserve percentage
    samplePolicy.approvals.requiredApprovalsCount = 1;
    samplePolicy.reserves.minReservePercentage = 8;
    samplePolicy.reserves.replenishThresholdPercentage = 5;
    samplePolicy.auditRetention.immutableAuditLog = false;


    const result = compilePayrollPolicy(samplePolicy);
    expect(result.isValid).toBe(true); // Still valid (not blocked)
    expect(result.hasWarnings).toBe(true);
    expect(result.summary.warningsCount).toBeGreaterThan(0);

    const warningTitles = result.issues
      .filter((i) => i.severity === "warning")
      .map((i) => i.title);

    expect(warningTitles).toContain("Single approver bottleneck");
    expect(warningTitles).toContain("Low reserve buffer ratio");
    expect(warningTitles).toContain("Mutable audit logs active");
  });

  it("flags critical errors and marks compilation as invalid", () => {
    // Cutoff lead time greater than settlement window
    samplePolicy.timing.settlementWindowHours = 12;
    samplePolicy.timing.cutoffLeadTimeHours = 18;
    // Self-approval with single approver
    samplePolicy.approvals.requiredApprovalsCount = 1;
    samplePolicy.approvals.allowSelfApproval = true;
    // Negative reserve floor
    samplePolicy.reserves.minReserveFixedAmount = -100;
    // Batch size exceeding Soroban limit
    samplePolicy.capacity.maxBatchSize = 6000;
    // Retention period below 30 days
    samplePolicy.auditRetention.retentionPeriodDays = 10;

    const result = compilePayrollPolicy(samplePolicy);
    expect(result.isValid).toBe(false);
    expect(result.summary.errorsCount).toBeGreaterThanOrEqual(5);
    expect(result.impactPreview.riskRating).toBe("critical");

    const errorTitles = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.title);

    expect(errorTitles).toContain("Cutoff exceeds settlement window");
    expect(errorTitles).toContain("Critical separation-of-duties violation");
    expect(errorTitles).toContain("Negative reserve floor");
    expect(errorTitles).toContain("Batch size exceeds contract limit");
    expect(errorTitles).toContain("Audit retention period too short");
  });
});

describe("PayrollPolicyStore", () => {
  beforeEach(() => {
    usePayrollPolicyStore.getState().resetToDefaults();
    usePayrollPolicyStore.getState().clearSaveStatus();
  });

  it("updates policy timing and re-compiles automatically", () => {
    const store = usePayrollPolicyStore.getState();
    store.updateTiming({ settlementWindowHours: 48, cutoffLeadTimeHours: 8 });

    const state = usePayrollPolicyStore.getState();
    expect(state.policy.timing.settlementWindowHours).toBe(48);
    expect(state.policy.timing.cutoffLeadTimeHours).toBe(8);
    expect(state.compilationResult.isValid).toBe(true);
  });

  it("blocks save when policy contains critical errors", async () => {
    const store = usePayrollPolicyStore.getState();
    // Invalidate policy
    store.updateTiming({ settlementWindowHours: 10, cutoffLeadTimeHours: 20 });

    expect(usePayrollPolicyStore.getState().compilationResult.isValid).toBe(false);

    const saved = await store.savePolicy();
    expect(saved).toBe(false);

    const state = usePayrollPolicyStore.getState();
    expect(state.saveSuccess).toBe(false);
    expect(state.saveError).toMatch(/Cannot save policy/i);
    expect(state.savedPolicy.version).toBe(1); // Version not bumped
  });

  it("successfully saves a valid policy, bumps version, and clears dirty state", async () => {
    const store = usePayrollPolicyStore.getState();
    store.updateTiming({ settlementWindowHours: 36 });

    const saved = await store.savePolicy("Admin Alice");
    expect(saved).toBe(true);

    const state = usePayrollPolicyStore.getState();
    expect(state.saveSuccess).toBe(true);
    expect(state.saveError).toBeNull();
    expect(state.savedPolicy.version).toBe(2);
    expect(state.savedPolicy.updatedBy).toBe("Admin Alice");
    expect(state.savedPolicy.timing.settlementWindowHours).toBe(36);
  });

  it("resets dirty changes back to saved state", () => {
    const store = usePayrollPolicyStore.getState();
    store.updateTiming({ settlementWindowHours: 72 });
    expect(usePayrollPolicyStore.getState().policy.timing.settlementWindowHours).toBe(72);

    store.resetToSaved();
    expect(usePayrollPolicyStore.getState().policy.timing.settlementWindowHours).toBe(24);
  });
});

describe("PayrollPolicyEditor Component", () => {
  beforeEach(() => {
    usePayrollPolicyStore.getState().resetToDefaults();
    usePayrollPolicyStore.getState().clearSaveStatus();
    usePayrollPolicyStore.getState().setActiveTab("all");
  });

  it("renders all editable sections and shows valid state by default", () => {
    render(<PayrollPolicyEditor />);

    expect(screen.getByText("Payroll Policy Editor")).toBeInTheDocument();
    expect(screen.getByTestId("policy-version-badge")).toHaveTextContent("v1.0");
    expect(screen.getByTestId("policy-status-synced")).toHaveTextContent("Active & Synced");

    // Sections rendered
    expect(screen.getByRole("heading", { name: /Timing & Settlement Windows/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Treasury Reserves & Liquidity/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Approval Requirements & Governance/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Throughput & Capacity Limits/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Audit Trails & Retention Settings/i })).toBeInTheDocument();

    // Compiler preview verdict
    expect(screen.getByTestId("compiler-verdict-banner")).toHaveTextContent(/Compilation Passed: Ready for Deployment/i);
    expect(screen.getByTestId("save-policy-btn")).toBeEnabled();
  });

  it("shows validation preview warnings when policy enters a warning state", async () => {
    render(<PayrollPolicyEditor />);

    // Uncheck immutable audit log to trigger a warning
    const immutableCheckbox = screen.getByLabelText(/Enforce Immutable Cryptographic Audit Log/i);
    fireEvent.click(immutableCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId("compiler-verdict-banner")).toHaveTextContent(/Compilation Passed with Warnings/i);
    });

    expect(screen.getByTestId("validation-warnings-list")).toBeInTheDocument();
    expect(within(screen.getByTestId("validation-warnings-list")).getByText(/Mutable audit logs active/i)).toBeInTheDocument();

    // Save button should still be enabled for warnings
    expect(screen.getByTestId("save-policy-btn")).toBeEnabled();
  });

  it("shows validation preview critical errors and blocks saving in an invalid state", async () => {
    render(<PayrollPolicyEditor />);

    // Change Cutoff Lead Time to 50 hours (greater than 24 hours settlement window)
    const cutoffInput = screen.getByLabelText(/Cutoff Lead Time \(Hours\)/i);
    fireEvent.change(cutoffInput, { target: { value: "50" } });

    await waitFor(() => {
      expect(screen.getByTestId("compiler-verdict-banner")).toHaveTextContent(/Compilation Failed/i);
    });

    // Error list appears before save
    const errorsList = screen.getByTestId("validation-errors-list");
    expect(errorsList).toBeInTheDocument();
    expect(within(errorsList).getByText(/Cutoff exceeds settlement window/i)).toBeInTheDocument();

    // Save blocked alert appears
    expect(screen.getByTestId("save-blocked-alert")).toBeInTheDocument();

    // Save button must be disabled
    const saveBtn = screen.getByTestId("save-policy-btn");
    expect(saveBtn).toBeDisabled();
  });


  it("saves a valid policy and updates UI to saved state", async () => {
    render(<PayrollPolicyEditor />);

    // Change settlement window from 24 to 48 hours
    const settlementInput = screen.getByLabelText(/Settlement Window \(Hours\)/i);
    fireEvent.change(settlementInput, { target: { value: "48" } });

    expect(screen.getByTestId("policy-status-dirty")).toHaveTextContent("Unsaved Changes");

    const saveBtn = screen.getByTestId("save-policy-btn");
    expect(saveBtn).toBeEnabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId("save-success-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/Payroll policy saved and compiled successfully!/i)).toBeInTheDocument();
    expect(screen.getByTestId("policy-version-badge")).toHaveTextContent("v2.0");
    expect(screen.getByTestId("policy-status-synced")).toHaveTextContent("Active & Synced");
    expect(screen.getByTestId("reset-to-saved-btn")).toBeDisabled();
  });

  it("filters views when switching tabs", async () => {
    render(<PayrollPolicyEditor />);

    // Switch to Approvals tab
    const approvalsTab = screen.getByTestId("tab-approvals");
    fireEvent.click(approvalsTab);

    expect(screen.getByRole("heading", { name: /Approval Requirements & Governance/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Timing & Settlement Windows/i })).not.toBeInTheDocument();

    // Switch to Capacity tab
    const capacityTab = screen.getByTestId("tab-capacity");
    fireEvent.click(capacityTab);

    expect(screen.getByRole("heading", { name: /Throughput & Capacity Limits/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Approval Requirements & Governance/i })).not.toBeInTheDocument();
  });

  it("resets changes when clicking Reset to Saved", () => {
    render(<PayrollPolicyEditor />);

    const settlementInput = screen.getByLabelText(/Settlement Window \(Hours\)/i);
    fireEvent.change(settlementInput, { target: { value: "72" } });
    expect(settlementInput).toHaveValue(72);

    const resetBtn = screen.getByTestId("reset-to-saved-btn");
    expect(resetBtn).toBeEnabled();
    fireEvent.click(resetBtn);

    expect(settlementInput).toHaveValue(24);
    expect(screen.getByTestId("policy-status-synced")).toBeInTheDocument();
  });
});

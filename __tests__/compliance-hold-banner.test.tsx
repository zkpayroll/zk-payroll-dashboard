/**
 * Compliance Hold Review Banner System tests.
 *
 * Covers:
 *  - All hold scopes: employer, period, batch, employee
 *  - Hold states: active, released, unauthorized
 *  - Banner rendering, release flow, and action blocking
 *  - Sensitive data redaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  useComplianceHoldsStore,
  type ComplianceHold,
  type ComplianceHoldScope,
  type ComplianceHoldReasonCode,
} from "@/stores/complianceHolds";

// ─── Mock data helpers ──────────────────────────────────────────────────────

let holdIdCounter = 0;

function createHold(overrides: Partial<ComplianceHold> = {}): ComplianceHold {
  holdIdCounter++;
  return {
    id: `hold_${holdIdCounter}`,
    scope: "employer",
    reasonCode: "regulatory_review",
    description: "Regulatory review in progress for all payroll operations",
    createdAt: "2026-08-15T10:00:00Z",
    status: "active",
    blockedActions: ["run_payroll", "send_payments"],
    releaseAuthorizedRoles: ["admin"],
    releaseInstruction:
      "Complete the regulatory filing before releasing this hold.",
    ...overrides,
  };
}

function resetStore() {
  useComplianceHoldsStore.getState().reset();
}

// ─── Store tests ────────────────────────────────────────────────────────────

describe("ComplianceHoldsStore", () => {
  beforeEach(() => {
    resetStore();
    holdIdCounter = 0;
  });

  it("starts with no holds", () => {
    const { holds } = useComplianceHoldsStore.getState();
    expect(holds).toEqual([]);
  });

  it("adds a hold", () => {
    const hold = createHold();
    useComplianceHoldsStore.getState().addHold(hold);
    const { holds } = useComplianceHoldsStore.getState();
    expect(holds).toHaveLength(1);
    expect(holds[0].id).toBe(hold.id);
  });

  it("sets multiple holds", () => {
    const holds = [
      createHold({ scope: "employer" }),
      createHold({ scope: "period" }),
      createHold({ scope: "batch" }),
      createHold({ scope: "employee" }),
    ];
    useComplianceHoldsStore.getState().setHolds(holds);
    expect(useComplianceHoldsStore.getState().holds).toHaveLength(4);
  });

  it("gets active holds only", () => {
    useComplianceHoldsStore.getState().setHolds([
      createHold({ status: "active" }),
      createHold({ status: "released" }),
      createHold({ status: "active" }),
    ]);
    const active = useComplianceHoldsStore.getState().getActiveHolds();
    expect(active).toHaveLength(2);
  });

  it("filters holds by scope", () => {
    useComplianceHoldsStore.getState().setHolds([
      createHold({ scope: "employer" }),
      createHold({ scope: "period" }),
      createHold({ scope: "batch" }),
    ]);
    const periodHolds = useComplianceHoldsStore
      .getState()
      .getHoldsByScope("period");
    expect(periodHolds).toHaveLength(1);
    expect(periodHolds[0].scope).toBe("period");
  });

  it("checks if action is blocked", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({ blockedActions: ["run_payroll"] })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("run_payroll")
    ).toBe(true);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("edit_employees")
    ).toBe(false);
  });

  it("gets all blocked actions", () => {
    useComplianceHoldsStore.getState().setHolds([
      createHold({ blockedActions: ["run_payroll", "send_payments"] }),
      createHold({ blockedActions: ["run_payroll", "modify_treasury"] }),
    ]);
    const blocked =
      useComplianceHoldsStore.getState().getAllBlockedActions();
    expect(blocked).toContain("run_payroll");
    expect(blocked).toContain("send_payments");
    expect(blocked).toContain("modify_treasury");
    expect(blocked).toHaveLength(3);
  });

  // ─── Release flow ───────────────────────────────────────────────────────

  it("releases a hold when authorized (admin)", () => {
    const hold = createHold({ releaseAuthorizedRoles: ["admin"] });
    useComplianceHoldsStore.getState().addHold(hold);
    useComplianceHoldsStore.getState().setCurrentRole("admin");

    const success = useComplianceHoldsStore
      .getState()
      .releaseHold(hold.id, "admin_user");
    expect(success).toBe(true);

    const released = useComplianceHoldsStore
      .getState()
      .holds.find((h) => h.id === hold.id);
    expect(released?.status).toBe("released");
    expect(released?.releasedBy).toBe("admin_user");
    expect(released?.releasedAt).toBeDefined();
  });

  it("prevents release when unauthorized (auditor)", () => {
    const hold = createHold({ releaseAuthorizedRoles: ["admin"] });
    useComplianceHoldsStore.getState().addHold(hold);
    useComplianceHoldsStore.getState().setCurrentRole("auditor");

    const success = useComplianceHoldsStore
      .getState()
      .releaseHold(hold.id, "auditor_user");
    expect(success).toBe(false);

    const stillActive = useComplianceHoldsStore
      .getState()
      .holds.find((h) => h.id === hold.id);
    expect(stillActive?.status).toBe("active");
  });

  it("prevents release of already released hold", () => {
    const hold = createHold({ status: "released" });
    useComplianceHoldsStore.getState().addHold(hold);
    useComplianceHoldsStore.getState().setCurrentRole("admin");

    const success = useComplianceHoldsStore
      .getState()
      .releaseHold(hold.id, "admin_user");
    expect(success).toBe(false);
  });

  it("canReleaseHolds returns true only for admin", () => {
    useComplianceHoldsStore.getState().setCurrentRole("admin");
    expect(useComplianceHoldsStore.getState().canReleaseHolds()).toBe(true);

    useComplianceHoldsStore.getState().setCurrentRole("operator");
    expect(useComplianceHoldsStore.getState().canReleaseHolds()).toBe(false);

    useComplianceHoldsStore.getState().setCurrentRole("auditor");
    expect(useComplianceHoldsStore.getState().canReleaseHolds()).toBe(false);
  });

  it("canReleaseHold checks per-hold authorization", () => {
    const adminOnlyHold = createHold({
      releaseAuthorizedRoles: ["admin"],
    });
    const auditorAllowedHold = createHold({
      releaseAuthorizedRoles: ["admin", "auditor"],
    });
    useComplianceHoldsStore.getState().setHolds([
      adminOnlyHold,
      auditorAllowedHold,
    ]);

    useComplianceHoldsStore.getState().setCurrentRole("auditor");
    expect(
      useComplianceHoldsStore.getState().canReleaseHold(adminOnlyHold.id)
    ).toBe(false);
    expect(
      useComplianceHoldsStore.getState().canReleaseHold(auditorAllowedHold.id)
    ).toBe(true);
  });

  // ─── Scope-specific hold behaviors ─────────────────────────────────────

  it("employer hold blocks all payroll actions", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        blockedActions: [
          "run_payroll",
          "send_payments",
          "approve_transactions",
          "modify_treasury",
        ],
      })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("run_payroll")
    ).toBe(true);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("send_payments")
    ).toBe(true);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("approve_transactions")
    ).toBe(true);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("modify_treasury")
    ).toBe(true);
  });

  it("period hold blocks payroll execution", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "period",
        blockedActions: ["run_payroll"],
      })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("run_payroll")
    ).toBe(true);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("send_payments")
    ).toBe(false);
  });

  it("batch hold blocks batch finalization", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "batch",
        blockedActions: ["finalize_batch"],
      })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("finalize_batch")
    ).toBe(true);
  });

  it("employee hold blocks employee-specific actions", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employee",
        targetLabel: "Employee ref: emp_a1b2c3d4",
        blockedActions: ["send_payments"],
      })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("send_payments")
    ).toBe(true);
  });

  it("does not block actions not in blockedActions list", () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        blockedActions: ["run_payroll"],
      })
    );
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("edit_employees")
    ).toBe(false);
    expect(
      useComplianceHoldsStore.getState().isActionBlocked("view_history")
    ).toBe(false);
  });
});

// ─── Banner rendering tests ─────────────────────────────────────────────────

describe("ComplianceHoldBanner", () => {
  beforeEach(() => {
    resetStore();
    holdIdCounter = 0;
  });

  it("renders nothing when there are no active holds", async () => {
    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);
    expect(
      screen.queryByTestId("compliance-hold-banner-container")
    ).not.toBeInTheDocument();
  });

  it("renders banner for employer hold", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        reasonCode: "regulatory_review",
      })
    );
    useComplianceHoldsStore.getState().setCurrentRole("admin");

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.getByTestId("compliance-hold-banner-container")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-hold-banner-employer")).toBeInTheDocument();
    expect(screen.getByText("Regulatory review in progress")).toBeInTheDocument();
  });

  it("renders banner for period hold", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "period",
        reasonCode: "tax_filing_pending",
      })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner scope="period" />);

    expect(screen.getByTestId("compliance-hold-banner-period")).toBeInTheDocument();
    expect(screen.getByText("Tax filing pending")).toBeInTheDocument();
  });

  it("renders banner for batch hold", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "batch",
        reasonCode: "audit_in_progress",
        targetLabel: "Batch #2026-08-A",
      })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner scope="batch" />);

    expect(screen.getByTestId("compliance-hold-banner-batch")).toBeInTheDocument();
    expect(screen.getByText(/Compliance audit in progress/)).toBeInTheDocument();
    expect(screen.getByText(/Batch #2026-08-A/)).toBeInTheDocument();
  });

  it("renders banner for employee hold with redacted target", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employee",
        reasonCode: "data_discrepancy",
        targetLabel: "Employee ref: emp_a1b2c3d4",
      })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner scope="employee" />);

    expect(screen.getByTestId("compliance-hold-banner-employee")).toBeInTheDocument();
    expect(screen.getByText(/Employee ref: emp_a1b2c3d4/)).toBeInTheDocument();
    // Ensure raw employee name is NOT displayed
    expect(screen.queryByText(/John Smith/)).not.toBeInTheDocument();
  });

  it("shows release button for admin role", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({ scope: "employer" })
    );
    useComplianceHoldsStore.getState().setCurrentRole("admin");

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.getByRole("button", { name: /release/i })).toBeInTheDocument();
  });

  it("hides release button for non-admin role", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({ scope: "employer", releaseAuthorizedRoles: ["admin"] })
    );
    useComplianceHoldsStore.getState().setCurrentRole("auditor");

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.queryByRole("button", { name: /release/i })).not.toBeInTheDocument();
  });

  it("releases hold when release button is clicked", async () => {
    const hold = createHold({ scope: "employer" });
    useComplianceHoldsStore.getState().addHold(hold);
    useComplianceHoldsStore.getState().setCurrentRole("admin");

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /release/i }));

    const state = useComplianceHoldsStore.getState();
    const released = state.holds.find((h) => h.id === hold.id);
    expect(released?.status).toBe("released");
  });

  it("does not render released holds", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({ scope: "employer", status: "released" })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(
      screen.queryByTestId("compliance-hold-banner-container")
    ).not.toBeInTheDocument();
  });
});

// ─── Payroll action guard tests ─────────────────────────────────────────────

describe("ComplianceHoldPayrollGuard", () => {
  beforeEach(() => {
    resetStore();
    holdIdCounter = 0;
  });

  it("renders children when action is not blocked", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({ blockedActions: ["run_payroll"] })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="edit_employees">
        <button>Edit Employees</button>
      </ComplianceHoldPayrollGuard>
    );

    const btn = screen.getByRole("button", { name: /edit employees/i });
    expect(btn).toBeEnabled();
  });

  it("disables and explains when action is blocked", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        blockedActions: ["run_payroll"],
        reasonCode: "regulatory_review",
      })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="run_payroll">
        <button>Run Payroll</button>
      </ComplianceHoldPayrollGuard>
    );

    expect(screen.getByTestId("payroll-action-blocked-run_payroll")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-hold-blocked-explanation")).toBeInTheDocument();
    expect(screen.getByText("Action blocked by compliance hold")).toBeInTheDocument();
  });

  it("shows explanation for employer hold scope", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        blockedActions: ["run_payroll"],
        reasonCode: "audit_in_progress",
      })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="run_payroll">
        <button>Run Payroll</button>
      </ComplianceHoldPayrollGuard>
    );

    expect(screen.getByText(/Compliance audit in progress/)).toBeInTheDocument();
    expect(screen.getByText(/Employer-wide/)).toBeInTheDocument();
  });

  it("shows explanation for period hold scope", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "period",
        blockedActions: ["run_payroll"],
        reasonCode: "tax_filing_pending",
      })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="run_payroll">
        <button>Run Payroll</button>
      </ComplianceHoldPayrollGuard>
    );

    expect(screen.getByText(/Tax filing pending/)).toBeInTheDocument();
    expect(screen.getByText(/Pay Period/)).toBeInTheDocument();
  });

  it("shows explanation for batch hold scope", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "batch",
        blockedActions: ["finalize_batch"],
        reasonCode: "manual_freeze",
      })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="finalize_batch">
        <button>Finalize Batch</button>
      </ComplianceHoldPayrollGuard>
    );

    expect(screen.getByText(/Manually frozen/)).toBeInTheDocument();
    expect(screen.getByText(/Batch scope/)).toBeInTheDocument();
  });

  it("shows explanation for employee hold scope", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employee",
        blockedActions: ["send_payments"],
        reasonCode: "authorization_expired",
        targetLabel: "Employee ref: emp_x9y8z7",
      })
    );

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="send_payments">
        <button>Send Payments</button>
      </ComplianceHoldPayrollGuard>
    );

    expect(screen.getByText(/Authorization has expired/)).toBeInTheDocument();
    expect(screen.getByText(/Employee scope/)).toBeInTheDocument();
    expect(screen.getByText(/Employee ref: emp_x9y8z7/)).toBeInTheDocument();
  });
});

// ─── Redaction verification tests ───────────────────────────────────────────

describe("Sensitive data redaction", () => {
  beforeEach(() => {
    resetStore();
    holdIdCounter = 0;
  });

  it("never exposes raw employee names in hold data", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employee",
        targetLabel: "Employee ref: emp_redacted123",
        description: "Data discrepancy for employee",
      })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.getByText(/Employee ref: emp_redacted123/)).toBeInTheDocument();
    expect(screen.queryByText(/John/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jane/)).not.toBeInTheDocument();
  });

  it("never exposes salary amounts in hold descriptions", async () => {
    useComplianceHoldsStore.getState().addHold(
      createHold({
        scope: "employer",
        description: "Compliance review. Salary data is handled separately.",
      })
    );

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.getByText(/Compliance review/)).toBeInTheDocument();
  });
});

// ─── Multiple holds tests ───────────────────────────────────────────────────

describe("Multiple concurrent holds", () => {
  beforeEach(() => {
    resetStore();
    holdIdCounter = 0;
  });

  it("renders banners for all active holds of different scopes", async () => {
    useComplianceHoldsStore.getState().setHolds([
      createHold({ scope: "employer", reasonCode: "regulatory_review" }),
      createHold({ scope: "period", reasonCode: "tax_filing_pending" }),
      createHold({ scope: "batch", reasonCode: "audit_in_progress" }),
      createHold({
        scope: "employee",
        reasonCode: "data_discrepancy",
        targetLabel: "Employee ref: emp_abc123",
      }),
    ]);

    const ComplianceHoldBanner = (
      await import("@/components/features/compliance/ComplianceHoldBanner")
    ).default;
    render(<ComplianceHoldBanner />);

    expect(screen.getByTestId("compliance-hold-banner-employer")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-hold-banner-period")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-hold-banner-batch")).toBeInTheDocument();
    expect(screen.getByTestId("compliance-hold-banner-employee")).toBeInTheDocument();
  });

  it("lists all blocking holds in the guard explanation", async () => {
    useComplianceHoldsStore.getState().setHolds([
      createHold({
        scope: "employer",
        blockedActions: ["run_payroll"],
        reasonCode: "regulatory_review",
      }),
      createHold({
        scope: "period",
        blockedActions: ["run_payroll"],
        reasonCode: "tax_filing_pending",
      }),
    ]);

    const { ComplianceHoldPayrollGuard } = await import(
      "@/components/features/compliance/ComplianceHoldPayrollGuard"
    );
    render(
      <ComplianceHoldPayrollGuard action="run_payroll">
        <button>Run Payroll</button>
      </ComplianceHoldPayrollGuard>
    );

    const explanation = screen.getByTestId("compliance-hold-blocked-explanation");
    expect(within(explanation).getByText(/Regulatory review in progress/)).toBeInTheDocument();
    expect(within(explanation).getByText(/Tax filing pending/)).toBeInTheDocument();
  });
});

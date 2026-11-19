import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  evaluatePayrollRunCompany,
  isPayrollRunCompanyActive,
  sanitizeCompanyWarningForAudit,
  resolveCompanyFromRegistry,
} from "@/lib/payroll/inactiveCompanyWarning";
import { InactiveCompanyWarningBanner } from "@/components/payroll/InactiveCompanyWarningBanner";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";
import type { Company, PayrollRun } from "@/types/models";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "tx_test_001" }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const ACTIVE_COMPANY: Company = {
  id: "comp_active_01",
  name: "Active Payroll Corp",
  admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  employeeCount: 5,
  isActive: true,
};

const INACTIVE_COMPANY: Company = {
  id: "comp_inactive_02",
  name: "Suspended Labs LLC",
  admin: "GBVXCPHJMZ5HZJMBBP3YMBM6HXKH3JRXJBHXJHXJHXJHXJHXJHXJHX",
  treasury: "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2",
  employeeCount: 3,
  isActive: false,
};

function createMockRun(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: "tx_run_762",
    companyId: "company_001", // Default active mock company
    timestamp: "2026-08-01T09:00:00Z",
    createdAt: "2026-08-01T09:00:00Z",
    totalAmount: 12500,
    employeeCount: 2,
    proof: "0xvalidproof_1234567890abcdef",
    status: "pending",
    employeeIds: ["emp_001", "emp_002"],
    executedAt: null,
    transactionHash: null,
    ...overrides,
  };
}

describe("Inactive Company Payroll Run Warning (#762)", () => {
  beforeEach(() => {
    useCompanyWarningsStore.getState().reset();
  });

  describe("evaluatePayrollRunCompany", () => {
    // 1. Successful case
    it("successfully validates when a payroll run references an active company", () => {
      const run = createMockRun({ companyId: "company_001" }); // MOCK_COMPANIES company_001 has isActive: true
      const evaluation = evaluatePayrollRunCompany(run);

      expect(evaluation.hasWarning).toBe(false);
      expect(evaluation.blocking).toBe(false);
      expect(evaluation.code).toBeNull();
      expect(evaluation.severity).toBeNull();
      expect(evaluation.companyId).toBe("company_001");
      expect(evaluation.companyName).toBe("ZK Payroll Inc.");
      expect(evaluation.message).toBeNull();
      expect(evaluation.actionHref).toBeNull();
      expect(isPayrollRunCompanyActive(run)).toBe(true);
    });

    it("successfully validates against a custom active company registry", () => {
      const run = createMockRun({ companyId: ACTIVE_COMPANY.id });
      const evaluation = evaluatePayrollRunCompany(run, [ACTIVE_COMPANY, INACTIVE_COMPANY]);

      expect(evaluation.hasWarning).toBe(false);
      expect(evaluation.blocking).toBe(false);
      expect(evaluation.companyName).toBe("Active Payroll Corp");
      expect(isPayrollRunCompanyActive(run, [ACTIVE_COMPANY])).toBe(true);
    });

    // 2. Rejected / Warning case
    it("flags a critical, blocking warning when a payroll run references an inactive company", () => {
      const run = createMockRun({ companyId: "company_002" }); // MOCK_COMPANIES company_002 has isActive: false
      const evaluation = evaluatePayrollRunCompany(run);

      expect(evaluation.hasWarning).toBe(true);
      expect(evaluation.blocking).toBe(true);
      expect(evaluation.code).toBe("COMPANY_INACTIVE");
      expect(evaluation.severity).toBe("critical");
      expect(evaluation.companyId).toBe("company_002");
      expect(evaluation.companyName).toBe("Accra Remote Collective");
      expect(evaluation.title).toMatch(/inactive company/i);
      expect(evaluation.message).toContain("Accra Remote Collective");
      expect(evaluation.message).toMatch(/currently inactive/i);
      expect(evaluation.actionHref).toBe("/company/switch");
      expect(evaluation.actionLabel).toMatch(/switch company/i);
      expect(evaluation.nextSteps.length).toBeGreaterThanOrEqual(2);
      expect(isPayrollRunCompanyActive(run)).toBe(false);
    });

    it("rejects an inactive company with custom Map registry", () => {
      const map = new Map<string, Company>();
      map.set(INACTIVE_COMPANY.id, INACTIVE_COMPANY);

      const run = createMockRun({ companyId: INACTIVE_COMPANY.id });
      const evaluation = evaluatePayrollRunCompany(run, map);

      expect(evaluation.hasWarning).toBe(true);
      expect(evaluation.blocking).toBe(true);
      expect(evaluation.code).toBe("COMPANY_INACTIVE");
      expect(evaluation.companyName).toBe(INACTIVE_COMPANY.name);
    });

    // 3. Boundary cases
    it("handles boundary case: missing or blank companyId on run", () => {
      const runNoCompany = createMockRun({ companyId: "" });
      const evaluationEmpty = evaluatePayrollRunCompany(runNoCompany);

      expect(evaluationEmpty.hasWarning).toBe(true);
      expect(evaluationEmpty.blocking).toBe(true);
      expect(evaluationEmpty.code).toBe("COMPANY_ID_MISSING");
      expect(evaluationEmpty.actionHref).toBe("/payroll");

      const runWhitespace = createMockRun({ companyId: "   " as any });
      const evaluationWhitespace = evaluatePayrollRunCompany(runWhitespace);
      expect(evaluationWhitespace.code).toBe("COMPANY_ID_MISSING");

      const runUndefined = createMockRun({ companyId: undefined as any });
      expect(evaluatePayrollRunCompany(runUndefined).code).toBe("COMPANY_ID_MISSING");
    });

    it("handles boundary case: referenced company not found in registry", () => {
      const run = createMockRun({ companyId: "comp_nonexistent_999" });
      const evaluation = evaluatePayrollRunCompany(run);

      expect(evaluation.hasWarning).toBe(true);
      expect(evaluation.blocking).toBe(true);
      expect(evaluation.code).toBe("COMPANY_NOT_FOUND");
      expect(evaluation.companyId).toBe("comp_nonexistent_999");
      expect(evaluation.title).toMatch(/not found/i);
      expect(evaluation.actionHref).toBe("/company/switch");
    });

    it("handles boundary case: null or undefined run parameter without throwing", () => {
      expect(() => evaluatePayrollRunCompany(null)).not.toThrow();
      expect(() => evaluatePayrollRunCompany(undefined)).not.toThrow();

      const evaluationNull = evaluatePayrollRunCompany(null);
      expect(evaluationNull.hasWarning).toBe(true);
      expect(evaluationNull.code).toBe("COMPANY_ID_MISSING");
    });

    it("handles boundary case: excessively long companyId by truncating safely", () => {
      const longId = "company_" + "x".repeat(100);
      const run = createMockRun({ companyId: longId });
      const evaluation = evaluatePayrollRunCompany(run);

      expect(evaluation.code).toBe("COMPANY_NOT_FOUND");
      expect(evaluation.companyId?.length).toBeLessThanOrEqual(40);
      expect(evaluation.companyId).toMatch(/\.\.\.$/);
    });

    it("supports dictionary / Record registry lookup", () => {
      const dict: Record<string, Company> = {
        [ACTIVE_COMPANY.id]: ACTIVE_COMPANY,
      };
      expect(resolveCompanyFromRegistry(ACTIVE_COMPANY.id, dict)).toEqual(ACTIVE_COMPANY);
      expect(resolveCompanyFromRegistry("unknown", dict)).toBeNull();
    });

    // Privacy guarantees
    it("strictly preserves privacy: never includes salary, amounts, or employee PII in messages", () => {
      const runInactive = createMockRun({ companyId: "company_002" });
      const evalInactive = evaluatePayrollRunCompany(runInactive);

      // Verify no salary or monetary amounts in user messages
      expect(evalInactive.message).not.toMatch(/salary/i);
      expect(evalInactive.message).not.toMatch(/\$\d+/);
      expect(evalInactive.message).not.toMatch(/amount/i);
      evalInactive.nextSteps.forEach((step) => {
        expect(step).not.toMatch(/salary/i);
        expect(step).not.toMatch(/\$\d+/);
      });

      // Verify audit serialization strips sensitive context
      const auditPayload = sanitizeCompanyWarningForAudit(evalInactive);
      expect(auditPayload).toEqual({
        code: "COMPANY_INACTIVE",
        companyId: "company_002",
        hasWarning: true,
        blocking: true,
        severity: "critical",
      });
      expect(JSON.stringify(auditPayload)).not.toContain("employee");
      expect(JSON.stringify(auditPayload)).not.toContain("totalAmount");
      expect(JSON.stringify(auditPayload)).not.toContain("proof");
    });
  });

  describe("InactiveCompanyWarningBanner component", () => {
    it("renders null when evaluation has no warning", () => {
      const evaluation = evaluatePayrollRunCompany(createMockRun({ companyId: "company_001" }));
      const { container } = render(<InactiveCompanyWarningBanner evaluation={evaluation} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders accessible alert banner with actionable links for inactive company", () => {
      const evaluation = evaluatePayrollRunCompany(createMockRun({ companyId: "company_002" }));
      render(<InactiveCompanyWarningBanner evaluation={evaluation} />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("data-testid", "inactive-company-payroll-warning");
      expect(alert).toHaveAttribute("data-warning-code", "COMPANY_INACTIVE");

      expect(screen.getByTestId("inactive-company-warning-title")).toHaveTextContent(
        /Payroll run references an inactive company/i,
      );
      expect(screen.getByTestId("inactive-company-warning-badge")).toHaveTextContent(
        "COMPANY_INACTIVE",
      );
      expect(screen.getByTestId("inactive-company-warning-message")).toHaveTextContent(
        /Accra Remote Collective, which is currently inactive/i,
      );

      const action = screen.getByTestId("inactive-company-warning-action");
      expect(action).toHaveAttribute("href", "/company/switch");
      expect(action).toHaveTextContent(/Switch company context/i);
    });

    it("supports optional onDismiss callback", () => {
      const onDismiss = vi.fn();
      const evaluation = evaluatePayrollRunCompany(createMockRun({ companyId: "company_002" }));
      render(<InactiveCompanyWarningBanner evaluation={evaluation} onDismiss={onDismiss} />);

      const dismissBtn = screen.getByText(/Dismiss/i);
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("PayrollRunDetail integration with inactive company warning", () => {
    it("renders normally and does not block execution when referenced company is active", () => {
      const activeRun = createMockRun({
        id: "run_active_test",
        companyId: "company_001",
        status: "pending",
      });

      render(
        <PayrollRunDetail
          run={activeRun}
          proofReference={{
            proofId: "zkp_ref_20260801_001",
            verifierContract: "CCVERIFIER",
            circuitHash: "0xcirc",
            publicSignalsDigest: "0xdig",
            proofStatus: "valid",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            rawProofHash: "0xraw",
          }}
        />,
      );

      // Warning banner must not be rendered
      expect(screen.queryByTestId("inactive-company-payroll-warning")).not.toBeInTheDocument();

      // Execution blocked badge for company must not be rendered
      expect(screen.queryByTestId("execution-blocked-by-company")).not.toBeInTheDocument();

      // Company info must display active state
      expect(screen.getByTestId("run-company-info")).toHaveTextContent("ZK Payroll Inc.");
      expect(screen.queryByTestId("run-company-inactive-badge")).not.toBeInTheDocument();
    });

    it("renders warning banner and blocks execution when referenced company is inactive", () => {
      const inactiveRun = createMockRun({
        id: "run_inactive_test",
        companyId: "company_002",
        status: "pending",
      });

      render(
        <PayrollRunDetail
          run={inactiveRun}
          proofReference={{
            proofId: "zkp_ref_20260801_002",
            verifierContract: "CCVERIFIER",
            circuitHash: "0xcirc",
            publicSignalsDigest: "0xdig",
            proofStatus: "valid",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            rawProofHash: "0xraw",
          }}
        />,
      );

      // Warning banner must be present
      expect(screen.getByTestId("inactive-company-payroll-warning")).toBeInTheDocument();
      expect(screen.getByTestId("inactive-company-warning-badge")).toHaveTextContent(
        "COMPANY_INACTIVE",
      );

      // Process payroll link must be blocked and replaced by execution-blocked badge
      expect(screen.queryByText("Process payroll")).not.toBeInTheDocument();
      const blockedPill = screen.getByTestId("execution-blocked-by-company");
      expect(blockedPill).toBeInTheDocument();
      expect(blockedPill).toHaveTextContent(/company inactive/i);

      // Company info shows inactive badge
      expect(screen.getByTestId("run-company-info")).toHaveTextContent("Accra Remote Collective");
      expect(screen.getByTestId("run-company-inactive-badge")).toBeInTheDocument();
    });
  });

  describe("useCompanyWarningsStore integration", () => {
    it("generates an inactive warning when companyState.isActive is set to false", () => {
      const store = useCompanyWarningsStore.getState();
      expect(store.getActiveWarnings()).toHaveLength(0);

      store.setCompanyState({ isActive: false });
      store.evaluateWarnings();

      const warnings = store.getActiveWarnings();
      const inactiveWarning = warnings.find((w) => w.reason === "inactive");
      expect(inactiveWarning).toBeDefined();
      expect(inactiveWarning?.severity).toBe("critical");
      expect(inactiveWarning?.title).toMatch(/Company is inactive/i);
      expect(inactiveWarning?.blockedActions).toContain("run_payroll");
      expect(store.hasBlockingWarnings()).toBe(true);
    });

    it("clears inactive warning when companyState.isActive is restored to true", () => {
      const store = useCompanyWarningsStore.getState();
      store.setCompanyState({ isActive: false });
      store.evaluateWarnings();
      expect(store.getActiveWarnings().some((w) => w.reason === "inactive")).toBe(true);

      store.setCompanyState({ isActive: true });
      store.evaluateWarnings();
      expect(store.getActiveWarnings().some((w) => w.reason === "inactive")).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  canPerformMutation,
  assertMutationAllowed,
  isContractPausedForCategory,
  ContractPausedError,
  CONTRACT_PAUSED_CODE,
  MUTATION_ACTIONS,
  type MutationAction,
  type ReadOnlyAction,
} from "@/src/payroll/contractPauseGuard";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

describe("contractPauseGuard", () => {
  beforeEach(() => {
    useCompanyWarningsStore.getState().reset();
  });

  describe("Successful cases", () => {
    it("allows mutation actions when contracts are not paused", () => {
      const result = canPerformMutation("execute_payroll", {
        isPaused: false,
        pausedCategories: [],
      });

      expect(result.allowed).toBe(true);
      expect(result.code).toBeNull();
      expect(result.message).toBeNull();
      expect(result.action).toBe("execute_payroll");
      expect(result.isMutation).toBe(true);
    });

    it("allows all registered mutation actions when contracts are active", () => {
      for (const action of MUTATION_ACTIONS) {
        const result = canPerformMutation(action, { isPaused: false });
        expect(result.allowed).toBe(true);
        expect(result.code).toBeNull();
      }
    });

    it("assertMutationAllowed does not throw when contracts are active", () => {
      expect(() => {
        assertMutationAllowed("create_payroll_draft", { isPaused: false });
      }).not.toThrow();
    });
  });

  describe("Rejected cases", () => {
    it("rejects mutation actions when contracts are paused for payroll", () => {
      const result = canPerformMutation("execute_payroll", {
        isPaused: true,
        pausedCategories: ["payroll"],
        reason: "Contract upgrade in progress",
      });

      expect(result.allowed).toBe(false);
      expect(result.code).toBe(CONTRACT_PAUSED_CODE);
      expect(result.message).toContain("Payroll smart contract operations are currently paused");
      expect(result.message).toContain("Contract upgrade in progress");
      expect(result.remediation).toBeDefined();
      expect(result.remediation?.action).toBe("resume_contract");
      expect(result.remediation?.href).toBe("/admin");
    });

    it("rejects all mutation actions when contracts are paused with empty categories (all paused)", () => {
      for (const action of MUTATION_ACTIONS) {
        const result = canPerformMutation(action, {
          isPaused: true,
          pausedCategories: [],
        });
        expect(result.allowed).toBe(false);
        expect(result.code).toBe(CONTRACT_PAUSED_CODE);
      }
    });

    it("throws ContractPausedError from assertMutationAllowed when paused", () => {
      expect(() => {
        assertMutationAllowed("execute_payroll", {
          isPaused: true,
          pausedCategories: ["payroll"],
        });
      }).toThrow(ContractPausedError);

      try {
        assertMutationAllowed("execute_payroll", {
          isPaused: true,
          pausedCategories: ["payroll"],
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ContractPausedError);
        const pauseErr = err as ContractPausedError;
        expect(pauseErr.code).toBe(CONTRACT_PAUSED_CODE);
        expect(pauseErr.action).toBe("execute_payroll");
        expect(pauseErr.remediation?.href).toBe("/admin");
      }
    });

    it("ensures rejection failure messages preserve privacy and contain zero financial or employee figures", () => {
      const result = canPerformMutation("create_payroll_draft", {
        isPaused: true,
        pausedCategories: ["payroll"],
        reason: "Emergency circuit breaker triggered",
      });

      expect(result.message).not.toMatch(/\$|USD|USDC|XLM|salary|employee_id|emp_/i);
      expect(result.message).toContain("Emergency circuit breaker triggered");
    });
  });

  describe("Boundary cases", () => {
    it("permits payroll mutation actions when pause only affects an unrelated category (e.g., audit or treasury)", () => {
      const result = canPerformMutation("create_payroll_draft", {
        isPaused: true,
        pausedCategories: ["audit"], // payroll is not in pausedCategories
      });

      expect(result.allowed).toBe(true);
      expect(result.code).toBeNull();
    });

    it("permits read-only dashboard actions even when contracts are paused", () => {
      const readOnlyActions: ReadOnlyAction[] = [
        "view_payroll",
        "view_audit",
        "view_treasury",
        "inspect_payload",
        "export_payroll_report",
      ];

      for (const action of readOnlyActions) {
        const result = canPerformMutation(action, {
          isPaused: true,
          pausedCategories: ["payroll", "admin", "treasury", "audit"],
        });

        expect(result.allowed).toBe(true);
        expect(result.isMutation).toBe(false);
        expect(result.code).toBeNull();
      }
    });

    it("blocks governance/admin mutations when admin category is paused", () => {
      const approveResult = canPerformMutation("approve_payroll", {
        isPaused: true,
        pausedCategories: ["admin"],
      });
      expect(approveResult.allowed).toBe(false);
      expect(approveResult.code).toBe(CONTRACT_PAUSED_CODE);

      const closeResult = canPerformMutation("period_close", {
        isPaused: true,
        pausedCategories: ["admin"],
      });
      expect(closeResult.allowed).toBe(false);
      expect(closeResult.code).toBe(CONTRACT_PAUSED_CODE);
    });

    it("correctly identifies category pause status via isContractPausedForCategory", () => {
      expect(isContractPausedForCategory("payroll", { isPaused: false })).toBe(false);
      expect(isContractPausedForCategory("payroll", { isPaused: true, pausedCategories: ["payroll"] })).toBe(true);
      expect(isContractPausedForCategory("payroll", { isPaused: true, pausedCategories: ["audit"] })).toBe(false);
      expect(isContractPausedForCategory("payroll", { isPaused: true, pausedCategories: [] })).toBe(true);
    });

    it("reads contract pause state from companyWarningsStore when input is omitted", () => {
      useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });

      const result = canPerformMutation("execute_payroll");
      expect(result.allowed).toBe(false);
      expect(result.code).toBe(CONTRACT_PAUSED_CODE);

      useCompanyWarningsStore.getState().setCompanyState({ isPaused: false });
      const resumed = canPerformMutation("execute_payroll");
      expect(resumed.allowed).toBe(true);
    });
  });
});

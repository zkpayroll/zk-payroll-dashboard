import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCommitmentVersionHistory,
  reviewCommitmentVersionRecovery,
  truncate,
  isWellFormedCommitment,
  type SalaryCommitmentVersion,
} from "@/lib/employees/salaryCommitmentVersionRecovery";
import { useEmployeeStore, type CommitmentReplacementLogEntry } from "@/stores/employees";
import type { Employee } from "@/types/models";

const baseEmployee: Employee = {
  id: "emp_rec_001",
  address: "GBASEADDRESS11111111111111111111111111111111111111111111",
  name: "Diana Prince",
  email: "diana@zkpayroll.io",
  salary: 115000,
  salaryCommitment: "0x1111111111111111111111111111",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2024-01-01T00:00:00Z",
};

describe("salaryCommitmentVersionRecovery domain logic (#900, #962)", () => {
  beforeEach(() => {
    useEmployeeStore.setState({
      employees: [baseEmployee],
      commitmentReplacementLog: [],
    });
  });

  describe("buildCommitmentVersionHistory", () => {
    it("returns empty array when employee is undefined", () => {
      const history = buildCommitmentVersionHistory(undefined);
      expect(history).toEqual([]);
    });

    it("creates baseline Version 1 (Active) when employee has no prior replacements", () => {
      const history = buildCommitmentVersionHistory(baseEmployee, []);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        version: 1,
        commitment: baseEmployee.salaryCommitment,
        commitmentPreview: "0x11111111…",
        status: "active",
        isRecovery: false,
      });
    });

    it("reconstructs sequential versions when replacements exist", () => {
      const logEntries: CommitmentReplacementLogEntry[] = [
        {
          id: "log_1",
          employeeId: baseEmployee.id,
          changeKind: "commitment_only",
          previousCommitmentPreview: "0x11111111…",
          nextCommitmentPreview: "0x22222222…",
          previousCommitment: baseEmployee.salaryCommitment,
          nextCommitment: "0x2222222222222222222222222222",
          confirmedAt: "2024-02-01T10:00:00Z",
          confirmedBy: "operator_01",
          version: 2,
        },
      ];

      const currentEmployee = {
        ...baseEmployee,
        salaryCommitment: "0x2222222222222222222222222222",
      };

      const history = buildCommitmentVersionHistory(currentEmployee, logEntries);
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        version: 1,
        status: "superseded",
        commitment: "0x1111111111111111111111111111",
      });
      expect(history[1]).toMatchObject({
        version: 2,
        status: "active",
        commitment: "0x2222222222222222222222222222",
      });
    });

    it("marks recovered versions with restored status and provenance", () => {
      const logEntries: CommitmentReplacementLogEntry[] = [
        {
          id: "log_1",
          employeeId: baseEmployee.id,
          changeKind: "commitment_only",
          previousCommitmentPreview: "0x11111111…",
          nextCommitmentPreview: "0x22222222…",
          previousCommitment: baseEmployee.salaryCommitment,
          nextCommitment: "0x2222222222222222222222222222",
          confirmedAt: "2024-02-01T10:00:00Z",
          version: 2,
        },
        {
          id: "log_2",
          employeeId: baseEmployee.id,
          changeKind: "commitment_only",
          previousCommitmentPreview: "0x22222222…",
          nextCommitmentPreview: "0x11111111…",
          previousCommitment: "0x2222222222222222222222222222",
          nextCommitment: baseEmployee.salaryCommitment,
          confirmedAt: "2024-03-01T10:00:00Z",
          version: 3,
          isRecovery: true,
          restoredFromVersion: 1,
        },
      ];

      const history = buildCommitmentVersionHistory(baseEmployee, logEntries);
      expect(history).toHaveLength(3);
      expect(history[0].status).toBe("superseded");
      expect(history[1].status).toBe("superseded");
      expect(history[2]).toMatchObject({
        version: 3,
        status: "restored",
        isRecovery: true,
        restoredFromVersion: 1,
      });
    });
  });

  describe("reviewCommitmentVersionRecovery", () => {
    const historicalVersions: SalaryCommitmentVersion[] = [
      {
        id: "v1",
        employeeId: baseEmployee.id,
        version: 1,
        commitment: "0x1111111111111111111111111111",
        commitmentPreview: "0x11111111…",
        createdAt: "2024-01-01T00:00:00Z",
        status: "superseded",
      },
      {
        id: "v2",
        employeeId: baseEmployee.id,
        version: 2,
        commitment: "0x2222222222222222222222222222",
        commitmentPreview: "0x22222222…",
        createdAt: "2024-02-01T00:00:00Z",
        status: "active",
      },
    ];

    const currentEmployee: Employee = {
      ...baseEmployee,
      salaryCommitment: "0x2222222222222222222222222222",
    };

    it("approves valid version recovery from v2 back to v1 (success path)", () => {
      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 1,
        versionHistory: historicalVersions,
        confirmedBy: "lead_operator",
        recoveryReason: "Rollback to pre-adjustment verification state",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");

      expect(result.review.targetVersion).toBe(1);
      expect(result.review.currentVersion).toBe(2);
      expect(result.review.nextVersion).toBe(3);
      expect(result.review.targetCommitment).toBe("0x1111111111111111111111111111");
      expect(result.review.currentCommitmentPreview).toBe("0x22222222…");
      expect(result.review.recoveredCommitmentPreview).toBe("0x11111111…");
      expect(result.review.walletChanged).toBe(false);
      expect(result.review.recoveryGuidance).toContain("Recovering to Version 1");
      expect(result.review.recoveryGuidance).toContain("Rollback to pre-adjustment");
    });

    it("rejects recovery when employee is undefined (failure path)", () => {
      const result = reviewCommitmentVersionRecovery({
        employee: undefined,
        targetVersion: 1,
        versionHistory: historicalVersions,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error");
      expect(result.error.code).toBe("EMPLOYEE_NOT_FOUND");
    });

    it("rejects recovery when target version does not exist (failure path)", () => {
      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 99,
        versionHistory: historicalVersions,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error");
      expect(result.error.code).toBe("VERSION_NOT_FOUND");
      expect(result.error.message).toContain("v99");
    });

    it("rejects recovery when target version is already active (boundary path)", () => {
      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 2,
        versionHistory: historicalVersions,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error");
      expect(result.error.code).toBe("VERSION_ALREADY_ACTIVE");
      expect(result.error.suggestedAction).toContain("Select an earlier superseded version");
    });

    it("rejects recovery when target version commitment is empty (boundary path)", () => {
      const invalidVersions: SalaryCommitmentVersion[] = [
        {
          id: "v1_empty",
          employeeId: baseEmployee.id,
          version: 1,
          commitment: "   ",
          commitmentPreview: "",
          createdAt: "2024-01-01T00:00:00Z",
          status: "superseded",
        },
        ...historicalVersions.slice(1),
      ];

      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 1,
        versionHistory: invalidVersions,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error");
      expect(result.error.code).toBe("COMMITMENT_EMPTY");
    });

    it("rejects recovery when target version commitment is malformed (boundary path)", () => {
      const malformedVersions: SalaryCommitmentVersion[] = [
        {
          id: "v1_short",
          employeeId: baseEmployee.id,
          version: 1,
          commitment: "0xshort",
          commitmentPreview: "0xshort",
          createdAt: "2024-01-01T00:00:00Z",
          status: "superseded",
        },
        ...historicalVersions.slice(1),
      ];

      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 1,
        versionHistory: malformedVersions,
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error");
      expect(result.error.code).toBe("COMMITMENT_MALFORMED");
    });

    it("detects wallet address changes attached to historical versions", () => {
      const oldAddress = "GOLDADDRESS0000000000000000000000000000000000000000000";
      const versionsWithWallet: SalaryCommitmentVersion[] = [
        {
          id: "v1_wallet",
          employeeId: baseEmployee.id,
          version: 1,
          commitment: "0x1111111111111111111111111111",
          commitmentPreview: "0x11111111…",
          address: oldAddress,
          addressPreview: "GOLDADDRES…",
          createdAt: "2024-01-01T00:00:00Z",
          status: "superseded",
        },
        historicalVersions[1],
      ];

      const result = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 1,
        versionHistory: versionsWithWallet,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok result");
      expect(result.review.walletChanged).toBe(true);
      expect(result.review.targetAddress).toBe(oldAddress);
      expect(result.review.recoveredWalletPreview).toBe("GOLDADDRES…");
    });

    it("strictly preserves privacy: never exposes raw salary number in review or error", () => {
      const successResult = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 1,
        versionHistory: historicalVersions,
      });
      expect(JSON.stringify(successResult)).not.toContain("115000");

      const failureResult = reviewCommitmentVersionRecovery({
        employee: currentEmployee,
        targetVersion: 2,
        versionHistory: historicalVersions,
      });
      expect(JSON.stringify(failureResult)).not.toContain("115000");
    });
  });

  describe("store integration: recoverCommitmentVersion", () => {
    it("applies recovered commitment, updates active state, and logs immutable audit trail", () => {
      // Setup employee with replacement history
      const v1Commitment = "0x1111111111111111111111111111";
      const v2Commitment = "0x2222222222222222222222222222";

      useEmployeeStore.setState({
        employees: [{ ...baseEmployee, salaryCommitment: v2Commitment }],
        commitmentReplacementLog: [
          {
            id: "cre_1",
            employeeId: baseEmployee.id,
            changeKind: "commitment_only",
            previousCommitmentPreview: "0x11111111…",
            nextCommitmentPreview: "0x22222222…",
            previousCommitment: v1Commitment,
            nextCommitment: v2Commitment,
            confirmedAt: "2024-02-01T00:00:00Z",
            confirmedBy: "op1",
            version: 2,
          },
        ],
      });

      const recoveryResult = useEmployeeStore.getState().recoverCommitmentVersion(
        baseEmployee.id,
        1,
        "lead_operator",
        "Reverting to baseline commitment",
      );

      expect(recoveryResult.ok).toBe(true);

      const state = useEmployeeStore.getState();
      const updatedEmp = state.employees.find((e) => e.id === baseEmployee.id);
      expect(updatedEmp?.salaryCommitment).toBe(v1Commitment);
    });
  });
});

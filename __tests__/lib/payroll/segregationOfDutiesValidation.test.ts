import { describe, expect, it } from "vitest";
import {
  validateSegregationOfDuties,
  checkCreatorApprovalViolation,
  getOperatorApprovalEligibility,
  canOperatorCreateBatch,
  canOperatorApproveBatch,
  type PayrollBatch,
  type PayrollOperator,
} from "@/lib/payroll/segregationOfDutiesValidation";

const mockOperator = (role: PayrollOperator["role"]): PayrollOperator => ({
  id: "op-001",
  name: "Test Operator",
  role,
});

const mockBatch = (createdBy: string): PayrollBatch => ({
  id: "batch-001",
  createdBy,
  createdAt: new Date().toISOString(),
  status: "submitted",
  approvals: [],
});

describe("segregationOfDutiesValidation", () => {
  describe("canOperatorCreateBatch", () => {
    it("allows admin to create batch", () => {
      expect(canOperatorCreateBatch(mockOperator("admin"))).toBe(true);
    });

    it("allows operator to create batch", () => {
      expect(canOperatorCreateBatch(mockOperator("operator"))).toBe(true);
    });

    it("prevents approver from creating batch", () => {
      expect(canOperatorCreateBatch(mockOperator("approver"))).toBe(false);
    });

    it("prevents viewer from creating batch", () => {
      expect(canOperatorCreateBatch(mockOperator("viewer"))).toBe(false);
    });
  });

  describe("canOperatorApproveBatch", () => {
    it("allows admin to approve batch", () => {
      expect(canOperatorApproveBatch(mockOperator("admin"))).toBe(true);
    });

    it("allows approver to approve batch", () => {
      expect(canOperatorApproveBatch(mockOperator("approver"))).toBe(true);
    });

    it("prevents operator from approving batch", () => {
      expect(canOperatorApproveBatch(mockOperator("operator"))).toBe(false);
    });

    it("prevents viewer from approving batch", () => {
      expect(canOperatorApproveBatch(mockOperator("viewer"))).toBe(false);
    });
  });

  describe("checkCreatorApprovalViolation", () => {
    it("detects when creator (admin) attempts to approve own batch", () => {
      const batch = mockBatch("op-001");
      const operator = mockOperator("admin");
      operator.id = "op-001";

      expect(checkCreatorApprovalViolation(batch, operator)).toBe(true);
    });

    it("detects when creator (approver admin) attempts to approve", () => {
      const batch = mockBatch("op-001");
      const operator = mockOperator("admin");
      operator.id = "op-001";

      expect(checkCreatorApprovalViolation(batch, operator)).toBe(true);
    });

    it("allows different operator to approve", () => {
      const batch = mockBatch("op-001");
      const operator = mockOperator("approver");
      operator.id = "op-002";

      expect(checkCreatorApprovalViolation(batch, operator)).toBe(false);
    });

    it("prevents non-approver from violating even if different", () => {
      const batch = mockBatch("op-001");
      const operator = mockOperator("operator");
      operator.id = "op-002";

      expect(checkCreatorApprovalViolation(batch, operator)).toBe(false);
    });
  });

  describe("getOperatorApprovalEligibility", () => {
    it("approver can approve batch created by different operator", () => {
      const batch = mockBatch("op-001");
      const approver = mockOperator("approver");
      approver.id = "op-002";

      const result = getOperatorApprovalEligibility(batch, approver);
      expect(result.eligible).toBe(true);
    });

    it("prevents approver from approving own batch", () => {
      const batch = mockBatch("op-001");
      const approver = mockOperator("approver");
      approver.id = "op-001";

      const result = getOperatorApprovalEligibility(batch, approver);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/prevent/i);
    });

    it("prevents non-approver role from approving", () => {
      const batch = mockBatch("op-001");
      const operator = mockOperator("operator");

      const result = getOperatorApprovalEligibility(batch, operator);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/approval authority/i);
    });

    it("prevents approval of non-submitted batch", () => {
      const batch = mockBatch("op-001");
      batch.status = "executed";
      const approver = mockOperator("approver");
      approver.id = "op-002";

      const result = getOperatorApprovalEligibility(batch, approver);
      expect(result.eligible).toBe(false);
      expect(result.reason).toMatch(/status/i);
    });
  });

  describe("validateSegregationOfDuties", () => {
    it("passes when different operators create and approve", () => {
      const batch = mockBatch("op-001");
      const approver = mockOperator("approver");
      approver.id = "op-002";

      const result = validateSegregationOfDuties(batch, approver);
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("fails when same operator creates and approves", () => {
      const batch = mockBatch("op-001");
      const admin = mockOperator("admin");
      admin.id = "op-001";

      const result = validateSegregationOfDuties(batch, admin);
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(
        result.violations.some((v) => v.type === "creator_cannot_approve"),
      ).toBe(true);
    });

    it("fails when operator lacks create permission", () => {
      const batch = mockBatch("op-001");
      const viewer = mockOperator("viewer");
      viewer.id = "op-002";

      const result = validateSegregationOfDuties(batch, viewer);
      expect(result.isValid).toBe(false);
    });

    it("sets canApprove flag correctly", () => {
      const batch = mockBatch("op-001");
      const approver = mockOperator("approver");
      approver.id = "op-002";

      const result = validateSegregationOfDuties(batch, approver);
      expect(result.canApprove).toBe(true);
    });

    it("prevents approval from creator", () => {
      const batch = mockBatch("op-001");
      const approver = mockOperator("approver");
      approver.id = "op-001";

      const result = validateSegregationOfDuties(batch, approver);
      expect(result.canApprove).toBe(false);
    });
  });
});

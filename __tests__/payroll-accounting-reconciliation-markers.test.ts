import { describe, it, expect } from "vitest";
import {
  createReconciliationMarker,
  resolveReconciliationMarker,
  evaluateAccountingReconciliationMarkers,
  assertAccountingReconciliationClear,
  AccountingReconciliationMarkerError,
  type ReconciliationMarker,
} from "@/src/payroll/payrollAccountingReconciliationMarkers";

describe("payrollAccountingReconciliationMarkers", () => {
  const RUN_ID = "run-2026-10-alpha";

  describe("createReconciliationMarker", () => {
    it("creates a balanced marker with resolved status and info severity", () => {
      const marker = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "net_disbursements",
        markerType: "balanced",
        description: "Net disbursements perfectly match treasury withdrawal",
      });

      expect(marker.id).toBe("m-1");
      expect(marker.severity).toBe("info");
      expect(marker.status).toBe("resolved");
    });

    it("defaults variance marker to critical severity and pending status", () => {
      const marker = createReconciliationMarker({
        id: "m-2",
        payrollRunId: RUN_ID,
        category: "tax_withholdings",
        markerType: "variance",
        description: "Tax withholding discrepancy detected",
        varianceAmount: 125.5,
      });

      expect(marker.severity).toBe("critical");
      expect(marker.status).toBe("pending");
      expect(marker.varianceAmount).toBe(125.5);
    });

    it("throws when required fields are missing", () => {
      expect(() =>
        createReconciliationMarker({
          id: "",
          payrollRunId: RUN_ID,
          category: "gas_network_fees",
          markerType: "timing_difference",
          description: "Pending gas fee confirmation",
        }),
      ).toThrowError("Marker id must be a non-empty string");

      expect(() =>
        createReconciliationMarker({
          id: "m-3",
          payrollRunId: "",
          category: "gas_network_fees",
          markerType: "timing_difference",
          description: "Pending gas fee confirmation",
        }),
      ).toThrowError("Payroll run id must be a non-empty string");

      expect(() =>
        createReconciliationMarker({
          id: "m-3",
          payrollRunId: RUN_ID,
          category: "gas_network_fees",
          markerType: "timing_difference",
          description: "",
        }),
      ).toThrowError("Marker description must be a non-empty string");
    });
  });

  describe("resolveReconciliationMarker", () => {
    it("resolves a pending marker with an audit note", () => {
      const marker = createReconciliationMarker({
        id: "m-4",
        payrollRunId: RUN_ID,
        category: "manual_adjustment",
        markerType: "manual_adjustment",
        description: "Rounding correction applied",
      });

      const resolved = resolveReconciliationMarker({
        marker,
        resolution: "resolved",
        note: "Audited and confirmed against bank statements",
      });

      expect(resolved.status).toBe("resolved");
      expect(resolved.resolutionNote).toBe("Audited and confirmed against bank statements");
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("waives a pending marker when designated", () => {
      const marker = createReconciliationMarker({
        id: "m-5",
        payrollRunId: RUN_ID,
        category: "timing_difference",
        markerType: "timing_difference",
        description: "Settlement delay within SLA",
      });

      const waived = resolveReconciliationMarker({
        marker,
        resolution: "waived",
        note: "Accepted within 24hr settlement SLA window",
      });

      expect(waived.status).toBe("waived");
      expect(waived.resolutionNote).toBe("Accepted within 24hr settlement SLA window");
    });

    it("throws when note is empty or marker is already resolved", () => {
      const marker = createReconciliationMarker({
        id: "m-6",
        payrollRunId: RUN_ID,
        category: "benefit_deductions",
        markerType: "balanced",
        description: "Balanced deduction",
      });

      expect(() =>
        resolveReconciliationMarker({
          marker,
          resolution: "resolved",
          note: "",
        }),
      ).toThrowError("Resolution note must be provided");

      expect(() =>
        resolveReconciliationMarker({
          marker,
          resolution: "resolved",
          note: "Already resolved",
        }),
      ).toThrowError("Marker m-6 is already in 'resolved' status");
    });
  });

  describe("evaluateAccountingReconciliationMarkers", () => {
    it("evaluates empty markers gracefully", () => {
      const summary = evaluateAccountingReconciliationMarkers(RUN_ID, []);
      expect(summary.totalMarkers).toBe(0);
      expect(summary.isAccountingReady).toBe(true);
      expect(summary.blockers).toHaveLength(0);
    });

    it("permits reconciliation when all markers are resolved or waived", () => {
      const m1 = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "net_disbursements",
        markerType: "balanced",
        description: "Balanced net pay",
      });
      const m2 = resolveReconciliationMarker({
        marker: createReconciliationMarker({
          id: "m-2",
          payrollRunId: RUN_ID,
          category: "tax_withholdings",
          markerType: "variance",
          description: "Minor tax variance",
        }),
        resolution: "waived",
        note: "Below threshold waiver applied",
      });

      const summary = evaluateAccountingReconciliationMarkers(RUN_ID, [m1, m2]);
      expect(summary.isAccountingReady).toBe(true);
      expect(summary.pendingCount).toBe(0);
      expect(summary.resolvedCount).toBe(1);
      expect(summary.waivedCount).toBe(1);
      expect(summary.blockers).toHaveLength(0);
    });

    it("blocks reconciliation when critical markers are pending", () => {
      const m1 = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "treasury_drawdown",
        markerType: "variance",
        description: "Drawdown mismatch on chain",
      });

      const summary = evaluateAccountingReconciliationMarkers(RUN_ID, [m1]);
      expect(summary.isAccountingReady).toBe(false);
      expect(summary.criticalPendingCount).toBe(1);
      expect(summary.blockers).toHaveLength(1);
      expect(summary.summaryMessage).toContain("Reconciliation blocked");
    });

    it("permits reconciliation with warnings if no critical blockers exist", () => {
      const m1 = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "timing_difference",
        markerType: "timing_difference",
        description: "Expected block propagation delay",
      });

      const summary = evaluateAccountingReconciliationMarkers(RUN_ID, [m1]);
      expect(summary.isAccountingReady).toBe(true);
      expect(summary.warnings).toHaveLength(1);
      expect(summary.blockers).toHaveLength(0);
      expect(summary.summaryMessage).toContain("Reconciliation permitted with 1 warning");
    });
  });

  describe("assertAccountingReconciliationClear", () => {
    it("does not throw when accounting reconciliation is clear", () => {
      const m1 = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "net_disbursements",
        markerType: "balanced",
        description: "Balanced",
      });

      expect(() => assertAccountingReconciliationClear(RUN_ID, [m1])).not.toThrow();
    });

    it("throws AccountingReconciliationMarkerError when blocked", () => {
      const m1 = createReconciliationMarker({
        id: "m-1",
        payrollRunId: RUN_ID,
        category: "disputed_entry",
        markerType: "disputed_entry",
        description: "Open dispute on ledger adjustment",
      });

      expect(() => assertAccountingReconciliationClear(RUN_ID, [m1])).toThrowError(
        AccountingReconciliationMarkerError,
      );
    });
  });
});

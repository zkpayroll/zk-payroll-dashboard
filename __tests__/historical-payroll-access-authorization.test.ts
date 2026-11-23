import { describe, it, expect } from "vitest";
import {
  evaluateHistoricalPayrollAccess,
  assertHistoricalPayrollAccess,
  HistoricalPayrollAccessAuthorizationError,
  DEFAULT_HISTORICAL_ACCESS_POLICY,
  type HistoricalRunRecord,
  type HistoricalAccessPolicy,
} from "@/src/payroll/historicalPayrollAccessAuthorization";

describe("historicalPayrollAccessAuthorization", () => {
  const NOW = 1_700_000_000_000;
  const MS_PER_DAY = 86_400_000;

  const RECENT_SETTLED_RUN: HistoricalRunRecord = {
    payrollRunId: "run-recent-settled",
    periodEndTimestamp: NOW - 30 * MS_PER_DAY, // 30 days old
    status: "settled",
  };

  const OLD_CLOSED_RUN: HistoricalRunRecord = {
    payrollRunId: "run-old-closed",
    periodEndTimestamp: NOW - 120 * MS_PER_DAY, // 120 days old
    status: "closed",
    isArchived: true,
  };

  const DEEP_ARCHIVE_RUN: HistoricalRunRecord = {
    payrollRunId: "run-deep-archive",
    periodEndTimestamp: NOW - 400 * MS_PER_DAY, // 400 days old
    status: "closed",
    isArchived: true,
  };

  const DRAFT_RUN: HistoricalRunRecord = {
    payrollRunId: "run-draft",
    periodEndTimestamp: NOW - 5 * MS_PER_DAY,
    status: "draft",
  };

  describe("evaluateHistoricalPayrollAccess", () => {
    it("blocks unauthenticated users", () => {
      const decision = evaluateHistoricalPayrollAccess({
        role: null,
        run: RECENT_SETTLED_RUN,
        now: NOW,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.rejectionReason).toBe("unauthenticated");
      expect(decision.scope).toBe("none");
    });

    it("grants full access to admin across all runs", () => {
      const d1 = evaluateHistoricalPayrollAccess({
        role: "admin",
        run: DRAFT_RUN,
        now: NOW,
      });
      expect(d1.allowed).toBe(true);
      expect(d1.scope).toBe("full");

      const d2 = evaluateHistoricalPayrollAccess({
        role: "admin",
        run: DEEP_ARCHIVE_RUN,
        now: NOW,
      });
      expect(d2.allowed).toBe(true);
      expect(d2.scope).toBe("full");
    });

    describe("operator role", () => {
      it("grants access to recent runs within window", () => {
        const decision = evaluateHistoricalPayrollAccess({
          role: "operator",
          run: RECENT_SETTLED_RUN, // 30 days <= 90 days
          now: NOW,
        });

        expect(decision.allowed).toBe(true);
        expect(decision.scope).toBe("recent_only");
      });

      it("rejects access to runs outside window without elevation", () => {
        const decision = evaluateHistoricalPayrollAccess({
          role: "operator",
          run: OLD_CLOSED_RUN, // 120 days > 90 days
          now: NOW,
        });

        expect(decision.allowed).toBe(false);
        expect(decision.rejectionReason).toBe("outside_operator_window");
        expect(decision.message).toContain("Admin elevation required");
      });

      it("grants access to runs outside window when elevation is approved", () => {
        const decision = evaluateHistoricalPayrollAccess({
          role: "operator",
          run: OLD_CLOSED_RUN,
          now: NOW,
          elevationApproved: true,
        });

        expect(decision.allowed).toBe(true);
        expect(decision.scope).toBe("recent_only");
        expect(decision.message).toContain("Operator elevation approved");
      });
    });

    describe("auditor role", () => {
      it("grants compliance access to settled historical runs", () => {
        const decision = evaluateHistoricalPayrollAccess({
          role: "auditor",
          run: RECENT_SETTLED_RUN,
          now: NOW,
        });

        expect(decision.allowed).toBe(true);
        expect(decision.scope).toBe("compliance_only");
      });

      it("blocks auditor access to draft or processing runs", () => {
        const decision = evaluateHistoricalPayrollAccess({
          role: "auditor",
          run: DRAFT_RUN,
          now: NOW,
        });

        expect(decision.allowed).toBe(false);
        expect(decision.rejectionReason).toBe("unsettled_run_restricted");
      });

      it("requires purpose for deep-archive runs (>365 days)", () => {
        const decisionWithoutPurpose = evaluateHistoricalPayrollAccess({
          role: "auditor",
          run: DEEP_ARCHIVE_RUN,
          now: NOW,
        });

        expect(decisionWithoutPurpose.allowed).toBe(false);
        expect(decisionWithoutPurpose.rejectionReason).toBe("purpose_required");

        const decisionWithPurpose = evaluateHistoricalPayrollAccess({
          role: "auditor",
          run: DEEP_ARCHIVE_RUN,
          now: NOW,
          purpose: "tax_audit",
        });

        expect(decisionWithPurpose.allowed).toBe(true);
        expect(decisionWithPurpose.scope).toBe("compliance_only");
      });
    });

    it("supports custom policy configuration", () => {
      const strictPolicy: HistoricalAccessPolicy = {
        ...DEFAULT_HISTORICAL_ACCESS_POLICY,
        operatorWindowDays: 14, // 2 weeks only
      };

      const decision = evaluateHistoricalPayrollAccess(
        {
          role: "operator",
          run: RECENT_SETTLED_RUN, // 30 days > 14 days
          now: NOW,
        },
        strictPolicy,
      );

      expect(decision.allowed).toBe(false);
      expect(decision.rejectionReason).toBe("outside_operator_window");
    });
  });

  describe("assertHistoricalPayrollAccess", () => {
    it("does not throw when authorized", () => {
      expect(() =>
        assertHistoricalPayrollAccess({
          role: "admin",
          run: RECENT_SETTLED_RUN,
          now: NOW,
        }),
      ).not.toThrow();
    });

    it("throws HistoricalPayrollAccessAuthorizationError when unauthorized", () => {
      expect(() =>
        assertHistoricalPayrollAccess({
          role: "operator",
          run: OLD_CLOSED_RUN,
          now: NOW,
        }),
      ).toThrowError(HistoricalPayrollAccessAuthorizationError);
    });
  });
});

import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import type { AuditRetentionPolicy } from "@/types/policy";
import {
  classifyRecordSettlementState,
  evaluateAuditRetention,
  evaluateRetentionPurgeGuard,
  filterPrunableAuditRecords,
  isSettlementFinalizedForRetention,
  isSettlementPendingForRetention,
  type AuditRecordMeta,
} from "@/src/audit/recordRetention";
import { RetentionSafeguardPanel } from "@/components/audit/RetentionSafeguardPanel";
import PayrollArchiveCenter from "@/components/features/archive/PayrollArchiveCenter";
import {
  evaluateArchiveRetentionPurge,
  useArchiveStore,
  type ArchivedPayrollRun,
} from "@/stores/archive";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXED_NOW = Date.UTC(2026, 10, 22, 12, 0, 0);

function makePolicy(
  overrides: Partial<AuditRetentionPolicy> = {},
): AuditRetentionPolicy {
  return {
    retentionPeriodDays: 365,
    immutableAuditLog: false,
    requireAuditorExportSignoff: true,
    detailedTelemetry: false,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<AuditRecordMeta> = {}): AuditRecordMeta {
  return {
    id: "aud_expired_001",
    createdAt: new Date(FIXED_NOW - 400 * DAY_MS).toISOString(),
    category: "payroll_run",
    settlementStatus: "settled",
    settlementPending: false,
    ...overrides,
  };
}

describe("Disable retention purge while settlement is pending (#859)", () => {
  beforeEach(() => {
    useArchiveStore.getState().reset();
  });

  describe("Domain retention & settlement finality evaluation", () => {
    it("permits pruning expired records when settlement is finalized", () => {
      for (const status of [
        "settled",
        "finalized",
        "verified",
        "completed",
      ] as const) {
        const rec = makeRecord({
          id: `aud_${status}`,
          settlementStatus: status,
          settlementPending: false,
        });
        expect(isSettlementFinalizedForRetention(rec)).toBe(true);
        expect(isSettlementPendingForRetention(rec)).toBe(false);

        const evaluation = evaluateAuditRetention([rec], makePolicy(), FIXED_NOW);
        expect(evaluation.decisions[0].allowed).toBe(true);
        expect(evaluation.prunableCount).toBe(1);
      }
    });

    it("blocks pruning expired records whenever settlement is pending or in flight", () => {
      const pendingStates = [
        "pending",
        "in_progress",
        "submitting",
        "executing",
        "awaiting_confirmation",
        "unconfirmed",
        "paused",
      ] as const;

      for (const status of pendingStates) {
        const rec = makeRecord({
          id: `aud_${status}`,
          settlementStatus: status,
        });
        expect(isSettlementPendingForRetention(rec)).toBe(true);
        expect(isSettlementFinalizedForRetention(rec)).toBe(false);

        const evaluation = evaluateAuditRetention([rec], makePolicy(), FIXED_NOW);
        expect(evaluation.decisions[0].allowed).toBe(false);
        expect(evaluation.decisions[0].reasons.join(" ")).toMatch(
          /settlement is still pending/i,
        );
        expect(filterPrunableAuditRecords([rec], makePolicy(), FIXED_NOW)).toEqual(
          [],
        );
      }

      const flagOnly = makeRecord({
        id: "aud_flag_pending",
        settlementStatus: "settled",
        settlementPending: true,
      });
      const flagEval = evaluateAuditRetention([flagOnly], makePolicy(), FIXED_NOW);
      expect(flagEval.decisions[0].allowed).toBe(false);
      expect(flagEval.decisions[0].reasons.join(" ")).toMatch(
        /settlement is still pending/i,
      );
    });

    it("fails closed on unknown, empty, null, failed, or unrecognized settlement states without echoing raw input", () => {
      const suspectInput = "pending_Alice_Johnson_145000_GSECRETKEY999";
      const unverifiedCases: Array<AuditRecordMeta["settlementStatus"]> = [
        "",
        "   ",
        null,
        "unknown",
        "failed",
        "disputed",
        suspectInput,
      ];

      for (const status of unverifiedCases) {
        expect(
          classifyRecordSettlementState({ settlementStatus: status }, false),
        ).toBe("unverified");

        const rec = makeRecord({ settlementStatus: status });
        const evaluation = evaluateAuditRetention([rec], makePolicy(), FIXED_NOW);
        expect(evaluation.decisions[0].allowed).toBe(false);
        const joinedReasons = evaluation.decisions[0].reasons.join(" ");
        expect(joinedReasons).toMatch(/settlement finality is unverified/i);
        expect(joinedReasons).not.toContain("Alice_Johnson");
        expect(joinedReasons).not.toContain("145000");
        expect(joinedReasons).not.toContain("GSECRETKEY999");
      }
    });

    it("enforces the exact retention window cutoff boundary with settled vs pending state", () => {
      const retentionMs = 365 * DAY_MS;
      const justInsideWindow = new Date(FIXED_NOW - retentionMs + 1).toISOString();
      const exactCutoff = new Date(FIXED_NOW - retentionMs).toISOString();

      const insideSettled = evaluateAuditRetention(
        [makeRecord({ id: "inside", createdAt: justInsideWindow, settlementStatus: "settled" })],
        makePolicy(),
        FIXED_NOW,
      );
      expect(insideSettled.decisions[0].allowed).toBe(false);

      const cutoffSettled = evaluateAuditRetention(
        [makeRecord({ id: "cutoff_ok", createdAt: exactCutoff, settlementStatus: "settled" })],
        makePolicy(),
        FIXED_NOW,
      );
      expect(cutoffSettled.decisions[0].allowed).toBe(true);

      const cutoffPending = evaluateAuditRetention(
        [makeRecord({ id: "cutoff_hold", createdAt: exactCutoff, settlementStatus: "pending" })],
        makePolicy(),
        FIXED_NOW,
      );
      expect(cutoffPending.decisions[0].allowed).toBe(false);
      expect(cutoffPending.decisions[0].reasons.join(" ")).toMatch(
        /settlement is still pending/i,
      );
    });

    it("disables batch retention purge when any record in a mixed batch has pending settlement", () => {
      const mixedRecords: AuditRecordMeta[] = [
        makeRecord({
          id: "aud_expired_settled",
          createdAt: new Date(FIXED_NOW - 500 * DAY_MS).toISOString(),
          settlementStatus: "settled",
        }),
        makeRecord({
          id: "aud_recent_pending",
          createdAt: new Date(FIXED_NOW - 5 * DAY_MS).toISOString(),
          settlementStatus: "awaiting_confirmation",
          settlementPending: true,
        }),
      ];

      const blockedGuard = evaluateRetentionPurgeGuard(
        mixedRecords,
        makePolicy(),
        FIXED_NOW,
        { requireExplicitSettlementState: true },
      );
      expect(blockedGuard.purgeAllowed).toBe(false);
      expect(blockedGuard.blockerCode).toBe("SETTLEMENT_PENDING");
      expect(blockedGuard.pendingSettlementCount).toBe(1);
      expect(blockedGuard.purgableRecordIds).toEqual([]);

      // Once the recent batch settles, only the expired settled record becomes purgable
      const settledBatch: AuditRecordMeta[] = [
        mixedRecords[0],
        {
          ...mixedRecords[1],
          settlementStatus: "settled",
          settlementPending: false,
        },
      ];
      const allowedGuard = evaluateRetentionPurgeGuard(
        settledBatch,
        makePolicy(),
        FIXED_NOW,
        { requireExplicitSettlementState: true },
      );
      expect(allowedGuard.purgeAllowed).toBe(true);
      expect(allowedGuard.blockerCode).toBeNull();
      expect(allowedGuard.purgableRecordIds).toEqual(["aud_expired_settled"]);
    });

    it("preserves append-only policy context alongside pending-settlement blocker reasons", () => {
      const guard = evaluateRetentionPurgeGuard(
        [makeRecord({ settlementStatus: "pending", settlementPending: true })],
        makePolicy({ immutableAuditLog: true }),
        FIXED_NOW,
      );

      expect(guard.purgeAllowed).toBe(false);
      expect(guard.blockerCode).toBe("SETTLEMENT_PENDING");
      expect(guard.reasons.join(" ")).toMatch(/pending confirmation/i);
      expect(guard.reasons.join(" ")).toMatch(/append-only audit logging/i);
    });
  });

  describe("RetentionSafeguardPanel UI guard", () => {
    it("disables purge trigger while settlement is pending and enables it once settled", () => {
      const onPurge = vi.fn();
      const pendingRecords: AuditRecordMeta[] = [
        makeRecord({
          id: "aud_settled_old",
          settlementStatus: "settled",
        }),
        makeRecord({
          id: "aud_inflight",
          createdAt: new Date(FIXED_NOW - 2 * DAY_MS).toISOString(),
          settlementStatus: "pending",
          settlementPending: true,
        }),
      ];

      const { rerender } = render(
        <RetentionSafeguardPanel
          policy={makePolicy()}
          records={pendingRecords}
          now={FIXED_NOW}
          onPurgePrunable={onPurge}
        />,
      );

      expect(
        screen.getByTestId("retention-settlement-pending-banner"),
      ).toHaveTextContent(/disabled while settlement is pending/i);
      const purgeBtn = screen.getByTestId("retention-purge-button");
      expect(purgeBtn).toBeDisabled();
      fireEvent.click(purgeBtn);
      expect(onPurge).not.toHaveBeenCalled();

      const finalizedRecords: AuditRecordMeta[] = [
        pendingRecords[0],
        {
          ...pendingRecords[1],
          settlementStatus: "settled",
          settlementPending: false,
        },
      ];

      rerender(
        <RetentionSafeguardPanel
          policy={makePolicy()}
          records={finalizedRecords}
          now={FIXED_NOW}
          onPurgePrunable={onPurge}
        />,
      );

      expect(
        screen.queryByTestId("retention-settlement-pending-banner"),
      ).toBeNull();
      const enabledBtn = screen.getByTestId("retention-purge-button");
      expect(enabledBtn).not.toBeDisabled();
      fireEvent.click(enabledBtn);
      expect(onPurge).toHaveBeenCalledTimes(1);
      expect(onPurge).toHaveBeenCalledWith(["aud_settled_old"]);
    });
  });

  describe("Archive store & PayrollArchiveCenter dashboard safeguards", () => {
    it("disables retention purge in the archive center while settlement is pending and rejects store purge calls", () => {
      const prunablePolicy = makePolicy();
      render(
        <PayrollArchiveCenter
          retentionPolicy={prunablePolicy}
          now={FIXED_NOW}
        />,
      );

      const purgeBar = screen.getByTestId("archive-retention-purge-bar");
      expect(purgeBar).toHaveAttribute("data-purge-allowed", "false");
      expect(purgeBar).toHaveAttribute("data-blocker-code", "SETTLEMENT_PENDING");
      expect(
        screen.getByTestId("archive-retention-purge-status"),
      ).toHaveTextContent("Disabled — Settlement Pending");
      expect(
        screen.getByTestId("archive-retention-purge-reason"),
      ).toHaveTextContent(/1 payroll settlement is pending confirmation/i);
      expect(
        screen.getByTestId("archive-purge-remediation-link"),
      ).toHaveAttribute("href", "/payroll/reconciliation");

      const purgeButton = screen.getByTestId("archive-retention-purge-button");
      expect(purgeButton).toBeDisabled();

      // Per-run settlement badge shows pending on arc_003 and finalized on arc_001
      expect(
        screen.getByTestId("settlement-status-badge-arc_003"),
      ).toHaveTextContent("Settlement pending");
      expect(
        screen.getByTestId("settlement-status-badge-arc_001"),
      ).toHaveTextContent("Settlement finalized");

      // Direct programmatic store call must also fail closed without mutating runs
      const initialCount = useArchiveStore.getState().runs.length;
      const directResult = useArchiveStore.getState().purgeExpiredRuns({
        policy: prunablePolicy,
        now: FIXED_NOW,
      });
      expect(directResult.allowed).toBe(false);
      expect(directResult.blockerCode).toBe("SETTLEMENT_PENDING");
      expect(directResult.purgedCount).toBe(0);
      expect(useArchiveStore.getState().runs).toHaveLength(initialCount);
    });

    it("unlocks retention purge once pending settlement finalizes and purges only expired settled non-disputed runs", () => {
      const prunablePolicy = makePolicy();
      render(
        <PayrollArchiveCenter
          retentionPolicy={prunablePolicy}
          now={FIXED_NOW}
        />,
      );

      expect(
        screen.getByTestId("archive-retention-purge-button"),
      ).toBeDisabled();

      // Finalize the pending multi-asset settlement on arc_003 reactively
      act(() => {
        useArchiveStore
          .getState()
          .setRunSettlementStatus("arc_003", "settled", false);
      });

      const latestBar = screen.getByTestId("archive-retention-purge-bar");
      expect(latestBar).toHaveAttribute("data-purge-allowed", "true");

      const purgeBtn = within(latestBar).getByTestId(
        "archive-retention-purge-button",
      );
      expect(purgeBtn).not.toBeDisabled();
      expect(purgeBtn).toHaveTextContent("Purge Expired Runs (3)");

      fireEvent.click(purgeBtn);

      const remainingIds = useArchiveStore.getState().runs.map((r) => r.id);
      // arc_001, arc_002, arc_005 (>365d, settled, archived) are purged;
      // arc_003 (within 365d retention window) and arc_004 (disputed & unarchived) remain!
      expect(remainingIds).toEqual(["arc_003", "arc_004"]);
      expect(
        within(latestBar).getByTestId("archive-retention-purge-feedback"),
      ).toHaveTextContent(/Purged 3 retention-expired payroll runs/i);
    });

    it("fails closed when an archived run has missing or unknown settlement status", () => {
      const missingStatusRun: ArchivedPayrollRun = {
        id: "arc_missing_settlement",
        payrollRunId: "tx_missing_01",
        employerName: "ZK Payroll Inc.",
        employerId: "company_001",
        payPeriod: "2024-06",
        asset: "USDC",
        status: "archived",
        auditAvailability: "available",
        totalAmount: 42000,
        employeeCount: 6,
        executedAt: "2024-06-30T10:00:00Z",
        transactionHash: "tx_hash_missing_settlement_status",
        isDisputed: false,
        isArchived: true,
        settlementStatus: undefined,
      };

      useArchiveStore.getState().setRuns([missingStatusRun]);
      const guard = evaluateArchiveRetentionPurge(
        useArchiveStore.getState().runs,
        makePolicy(),
        FIXED_NOW,
      );
      expect(guard.purgeAllowed).toBe(false);
      expect(guard.blockerCode).toBe("SETTLEMENT_UNVERIFIED");

      const result = useArchiveStore.getState().purgeExpiredRuns({
        policy: makePolicy(),
        now: FIXED_NOW,
      });
      expect(result.allowed).toBe(false);
      expect(result.blockerCode).toBe("SETTLEMENT_UNVERIFIED");
      expect(useArchiveStore.getState().runs).toHaveLength(1);
    });

    it("never exposes private salary figures, employee names, wallet keys, or tx hashes in purge reasons or safeguard UI", () => {
      const sensitiveRun: ArchivedPayrollRun = {
        id: "arc_priv_01",
        payrollRunId: "tx_priv_901",
        employerName: "Confidential Employer Corp",
        employerId: "company_priv",
        payPeriod: "2024-05",
        asset: "USDC",
        status: "archived",
        auditAvailability: "available",
        totalAmount: 187450,
        employeeCount: 1,
        executedAt: "2024-05-15T10:00:00Z",
        transactionHash: "tx_secret_hash_998877665544332211",
        isDisputed: false,
        isArchived: true,
        archivedBy: "GSECRETWALLETKEY1234567890ABCDEFGHJKLMNPQRSTUV",
        notes: "Executive payout for Jane Doe ($187,450)",
        settlementStatus: "pending",
        settlementPending: true,
      };

      useArchiveStore.getState().setRuns([sensitiveRun]);
      const prunablePolicy = makePolicy();

      const rejection = useArchiveStore.getState().purgeExpiredRuns({
        policy: prunablePolicy,
        now: FIXED_NOW,
      });
      render(
        <PayrollArchiveCenter
          retentionPolicy={prunablePolicy}
          now={FIXED_NOW}
        />,
      );

      const safeguardText =
        screen.getByTestId("archive-retention-purge-bar").textContent ?? "";
      for (const secretFragment of [
        "Jane Doe",
        "187450",
        "187,450",
        "GSECRETWALLETKEY",
        "tx_secret_hash_998877665544332211",
        "tx_priv_901",
      ]) {
        expect(rejection.reason).not.toContain(secretFragment);
        expect(safeguardText).not.toContain(secretFragment);
      }
    });
  });
});

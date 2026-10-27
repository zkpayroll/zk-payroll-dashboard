import { describe, expect, it } from "vitest";
import {
  compareSettlementEvents,
  orderSettlementEvents,
  sanitizeSettlementEventForDisplay,
  validateSettlementEventCoordinates,
  type SettlementEventLike,
} from "@/lib/history/settlementEventOrdering";

describe("orderSettlementEvents (#854)", () => {
  it("orders events across distinct ledgers and breaks same-ledger ties deterministically by txIndex and opIndex", () => {
    const events: SettlementEventLike[] = [
      {
        id: "evt_b",
        ledgerSequence: 512040,
        txIndex: 2,
        opIndex: 1,
        timestamp: "2026-04-10T10:00:00Z",
        stage: "settled",
      },
      {
        id: "evt_a",
        ledgerSequence: 512040,
        txIndex: 2,
        opIndex: 0,
        timestamp: "2026-04-10T10:00:00Z",
        stage: "submitted",
      },
      {
        id: "evt_c",
        ledgerSequence: 512040,
        txIndex: 1,
        opIndex: 3,
        timestamp: "2026-04-10T10:00:00Z",
        stage: "initiated",
      },
      {
        id: "evt_newer_ledger",
        ledgerSequence: 512041,
        txIndex: 0,
        opIndex: 0,
        timestamp: "2026-04-10T10:00:05Z",
        stage: "initiated",
      },
    ];

    const { ordered, issues } = orderSettlementEvents(events, {
      ledgerDirection: "desc",
      sameLedgerDirection: "asc",
    });

    expect(issues).toHaveLength(0);
    expect(ordered.map((e) => e.id)).toEqual([
      "evt_newer_ledger",
      "evt_c",
      "evt_a",
      "evt_b",
    ]);
  });

  it("breaks ties within the same ledger and transaction using confirmationNonce, lifecycle stage, and id", () => {
    const events: SettlementEventLike[] = [
      {
        id: "evt_reconciled",
        ledgerSequence: 900100,
        txIndex: 0,
        opIndex: 0,
        confirmationNonce: "1002",
        stage: "reconciled",
      },
      {
        id: "evt_settled_b",
        ledgerSequence: 900100,
        txIndex: 0,
        opIndex: 0,
        confirmationNonce: "1001",
        stage: "settled",
      },
      {
        id: "evt_settled_a",
        ledgerSequence: 900100,
        txIndex: 0,
        opIndex: 0,
        confirmationNonce: "1001",
        stage: "settled",
      },
      {
        id: "evt_submitted",
        ledgerSequence: 900100,
        txIndex: 0,
        opIndex: 0,
        confirmationNonce: "1001",
        stage: "submitted",
      },
    ];

    const { ordered } = orderSettlementEvents(events);
    expect(ordered.map((e) => e.id)).toEqual([
      "evt_submitted",
      "evt_settled_a",
      "evt_settled_b",
      "evt_reconciled",
    ]);
  });

  it("produces identical ordering regardless of input permutation", () => {
    const base: SettlementEventLike[] = [
      { id: "tx_1", createdAt: "2026-04-10T12:00:00Z", txIndex: 0, opIndex: 0, stage: "initiated" },
      { id: "tx_2", createdAt: "2026-04-10T12:00:00Z", txIndex: 0, opIndex: 1, stage: "proof_verified" },
      { id: "tx_3", createdAt: "2026-04-10T12:00:00Z", txIndex: 0, opIndex: 2, stage: "settled" },
    ];
    const reversed = [...base].reverse();

    const firstOrder = orderSettlementEvents(base).ordered.map((e) => e.id);
    const secondOrder = orderSettlementEvents(reversed).ordered.map((e) => e.id);

    expect(firstOrder).toEqual(["tx_1", "tx_2", "tx_3"]);
    expect(secondOrder).toEqual(firstOrder);
    expect(compareSettlementEvents(base[0], base[0])).toBe(0);
  });

  it("surfaces clear validation issues for invalid ledger coordinates or timestamps", () => {
    const invalidEvent: SettlementEventLike = {
      id: "",
      ledgerSequence: 0,
      txIndex: -1,
      opIndex: -2,
      createdAt: "not-a-timestamp",
    };

    const issues = validateSettlementEventCoordinates(invalidEvent);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("missing_event_id");
    expect(codes).toContain("invalid_ledger_sequence");
    expect(codes).toContain("negative_tx_index");
    expect(codes).toContain("negative_op_index");
    expect(codes).toContain("invalid_timestamp");
  });

  it("redacts raw ZK proof strings and masks long transaction hashes for privacy", () => {
    const sanitized = sanitizeSettlementEventForDisplay({
      id: "tx_001",
      proof: "0xsecret_zk_proof_payload_bytes",
      txHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    });

    expect(sanitized.proof).toBe("[REDACTED_ZK_PROOF]");
    expect(sanitized.maskedTxHash).toBe("9f86d0…0a08");
  });
});

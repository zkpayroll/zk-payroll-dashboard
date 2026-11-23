/**
 * @vitest-environment jsdom
 *
 * Unit tests for treasury reservation guidance, BigInt precision math,
 * fail-closed expiry guards, bounded PII sanitization, and privacy invariants (#887).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_NEW_RESERVATION_AMOUNT,
  MAX_IDENTIFIER_LENGTH,
  describeSingleReservationGuidance,
  evaluateTreasuryReservationGuidance,
  formatReservationUnits,
  getReservationActionGuides,
  parseReservationAmountUnits,
  sanitizeReservationIdentifier,
  unitsToPlainDecimal,
} from "@/lib/treasury/reservationGuidance";
import { evaluateTreasuryReservationGuidance as evaluateFromSrc } from "@/src/treasury/reservationGuidance";
import {
  MAX_RESERVATION_TTL_MS,
  RESERVATION_TTL_MS,
  RESERVATION_WARNING_WINDOW_MS,
  getReservationStatus,
  getTimeRemaining,
  useReservationsStore,
  type FundingReservation,
} from "@/stores/reservations";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";

const MINUTE = 60 * 1000;
const BASE_NOW = 1_700_000_000_000;

function makeReservation(
  overrides: Partial<FundingReservation> = {},
): FundingReservation {
  return {
    id: "res_guide_1",
    batchId: "BATCH-GUIDE-01",
    asset: "USDC",
    amount: "15,000.00",
    reservedAt: new Date(BASE_NOW - 2 * MINUTE).toISOString(),
    expiresAt: new Date(BASE_NOW + 13 * MINUTE).toISOString(),
    canRefresh: true,
    canCancel: true,
    canRevalidate: true,
    ...overrides,
  };
}

describe("treasury reservation guidance module (#887)", () => {
  beforeEach(() => {
    useReservationsStore.getState().reset();
  });

  it("re-exports cleanly from src/treasury/reservationGuidance", () => {
    expect(evaluateFromSrc).toBe(evaluateTreasuryReservationGuidance);
    expect(getReservationActionGuides()).toHaveLength(4);
  });

  describe("BigInt 7-decimal stroop parsing & boundary precision", () => {
    it("parses plain, currency-prefixed, and thousands-comma strings without floats", () => {
      expect(parseReservationAmountUnits("15,000.00")).toEqual({
        ok: true,
        units: BigInt("150000000000"),
      });
      expect(parseReservationAmountUnits("$45,000.5")).toEqual({
        ok: true,
        units: BigInt("450005000000"),
      });
      expect(parseReservationAmountUnits(0.1)).toEqual({
        ok: true,
        units: BigInt("1000000"),
      });
      expect(parseReservationAmountUnits("0.0000001")).toEqual({
        ok: true,
        units: BigInt("1"),
      });
    });

    it("rejects malformed commas, negative numbers, >7 decimals, and non-finite values", () => {
      expect(parseReservationAmountUnits("")).toEqual({ ok: false, reason: "missing" });
      expect(parseReservationAmountUnits(null)).toEqual({ ok: false, reason: "missing" });
      expect(parseReservationAmountUnits(-10)).toEqual({ ok: false, reason: "negative" });
      expect(parseReservationAmountUnits("-15,000.00")).toEqual({ ok: false, reason: "negative" });
      expect(parseReservationAmountUnits("$-5")).toEqual({ ok: false, reason: "negative" });
      expect(parseReservationAmountUnits("1,00.00")).toEqual({ ok: false, reason: "invalid" });
      expect(parseReservationAmountUnits("1,,000")).toEqual({ ok: false, reason: "invalid" });
      expect(parseReservationAmountUnits("1e5")).toEqual({ ok: false, reason: "invalid" });
      expect(parseReservationAmountUnits("1.12345678")).toEqual({ ok: false, reason: "invalid" });
      expect(parseReservationAmountUnits(Number.NaN)).toEqual({ ok: false, reason: "invalid" });
      expect(parseReservationAmountUnits(Number.POSITIVE_INFINITY)).toEqual({
        ok: false,
        reason: "invalid",
      });
    });

    it("handles classic IEEE-754 0.1 + 0.2 summation without precision drift", () => {
      const result = evaluateTreasuryReservationGuidance({
        availableBalance: "0.4",
        projectedPayroll: "0.3",
        newReservationAmount: "0.1",
        reservations: [
          makeReservation({ id: "r1", amount: "0.1" }),
          makeReservation({ id: "r2", amount: "0.2" }),
        ],
        now: BASE_NOW,
      });

      expect(result.reasonCode).toBe("RESERVATIONS_HEALTHY");
      expect(result.formattedActiveReserved).toBe("0.30 USDC");
      expect(result.formattedUnreservedBalance).toBe("0.10 USDC");
      expect(unitsToPlainDecimal(BigInt(1))).toBe("0.0000001");
      expect(formatReservationUnits(BigInt("150000000000"))).toBe("15,000");

      const exactTight = evaluateTreasuryReservationGuidance({
        availableBalance: "0.3",
        projectedPayroll: "0.3",
        newReservationAmount: "0.1",
        reservations: [
          makeReservation({ id: "r1", amount: "0.1" }),
          makeReservation({ id: "r2", amount: "0.2" }),
        ],
        now: BASE_NOW,
      });
      expect(exactTight.reasonCode).toBe("RESERVATION_LIQUIDITY_TIGHT");
      expect(exactTight.formattedUnreservedBalance).toBe("0 USDC");
    });

    it("catches 1-stroop (0.0000001) over-reservation at the exact balance boundary", () => {
      const exactResult = evaluateTreasuryReservationGuidance({
        availableBalance: 45000,
        projectedPayroll: 19500,
        newReservationAmount: DEFAULT_NEW_RESERVATION_AMOUNT,
        reservations: [makeReservation({ id: "r_exact", amount: "45,000.00" })],
        now: BASE_NOW,
      });
      expect(exactResult.reasonCode).toBe("RESERVATION_LIQUIDITY_TIGHT");
      expect(exactResult.canCreateReservation).toBe(false);

      const overByOneStroop = evaluateTreasuryReservationGuidance({
        availableBalance: 45000,
        projectedPayroll: 19500,
        reservations: [makeReservation({ id: "r_over", amount: "45000.0000001" })],
        now: BASE_NOW,
      });
      expect(overByOneStroop.reasonCode).toBe("OVER_RESERVATION_BLOCKED");
      expect(overByOneStroop.canExecutePayroll).toBe(false);
    });

    it("isolates reserved totals by asset code while preserving global lock counts", () => {
      const result = evaluateTreasuryReservationGuidance({
        availableBalance: 20000,
        projectedPayroll: 10000,
        assetCode: "USDC",
        newReservationAmount: "5000",
        reservations: [
          makeReservation({ id: "r_usdc", asset: "USDC", amount: "10,000.00" }),
          makeReservation({ id: "r_xlm", asset: "XLM", amount: "50,000.00" }),
        ],
        now: BASE_NOW,
      });

      expect(result.reasonCode).toBe("RESERVATIONS_HEALTHY");
      expect(result.counts.total).toBe(2);
      expect(result.formattedActiveReserved).toBe("10,000 USDC");
      expect(result.formattedUnreservedBalance).toBe("10,000 USDC");
      expect(result.canCreateReservation).toBe(true);
    });
  });

  describe("Fail-closed expiry, TTL sanitization, and deduplication", () => {
    it("fails closed on invalid/corrupted timestamps and NaN clock inputs", () => {
      expect(getReservationStatus({ expiresAt: "" }, BASE_NOW)).toBe("expired");
      expect(getReservationStatus({ expiresAt: "not-a-date" }, BASE_NOW)).toBe("expired");
      expect(
        getReservationStatus(
          { expiresAt: new Date(BASE_NOW + 10 * MINUTE).toISOString() },
          Number.NaN,
        ),
      ).toBe("expired");

      expect(getTimeRemaining({ expiresAt: "invalid" }, BASE_NOW)).toBe(0);
      expect(
        getTimeRemaining(
          { expiresAt: new Date(BASE_NOW + 10 * MINUTE).toISOString() },
          Number.NaN,
        ),
      ).toBe(0);
    });

    it("enforces exact boundary rules at 0ms expiry and 5m warning window", () => {
      const atExpiry = { expiresAt: new Date(BASE_NOW).toISOString() };
      const atWarningEdge = {
        expiresAt: new Date(BASE_NOW + RESERVATION_WARNING_WINDOW_MS).toISOString(),
      };
      expect(getReservationStatus(atExpiry, BASE_NOW)).toBe("expired");
      expect(getReservationStatus(atWarningEdge, BASE_NOW)).toBe("warning");
    });

    it("falls back safely when invalid ttlMs is passed and deduplicates store entries", () => {
      const store = useReservationsStore.getState();
      const first = makeReservation({ id: "dup_1", amount: "5,000.00" });
      const updated = makeReservation({ id: "dup_1", amount: "9,000.00" });

      store.setReservations([first, updated]);
      expect(useReservationsStore.getState().reservations).toHaveLength(1);
      expect(useReservationsStore.getState().getReservation("dup_1")?.amount).toBe("9,000.00");

      store.addReservation(makeReservation({ id: "dup_1", amount: "12,000.00" }));
      expect(useReservationsStore.getState().reservations).toHaveLength(1);
      expect(useReservationsStore.getState().getReservation("dup_1")?.amount).toBe("12,000.00");

      expect(() => store.refreshReservation("dup_1", Number.NaN)).not.toThrow();
      expect(() => store.revalidateReservation("dup_1", -500)).not.toThrow();
      expect(() => store.refreshReservation("dup_1", Number.MAX_SAFE_INTEGER)).not.toThrow();
      expect(() => store.revalidateReservation("dup_1", MAX_RESERVATION_TTL_MS + 1)).not.toThrow();
      const refreshed = useReservationsStore.getState().getReservation("dup_1")!;
      expect(
        new Date(refreshed.expiresAt).getTime() - Date.now(),
      ).toBeLessThanOrEqual(RESERVATION_TTL_MS + 1000);
    });
  });

  describe("10 priority guidance reason codes & per-item descriptions", () => {
    it("covers all 10 evaluation reason codes deterministically", () => {
      expect(
        evaluateTreasuryReservationGuidance({
          hasConfiguredAssets: false,
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("ASSETS_UNCONFIGURED");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: -1,
          projectedPayroll: 19500,
          reservations: [],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("INVALID_TREASURY_DATA");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [makeReservation({ expiresAt: "broken-iso" })],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("INVALID_TREASURY_DATA");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 1000,
          projectedPayroll: 50000,
          reservations: [],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("INSUFFICIENT_TREASURY_BALANCE");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 20000,
          projectedPayroll: 10000,
          reservations: [
            makeReservation({ id: "a", amount: "15,000.00" }),
            makeReservation({ id: "b", amount: "10,000.00" }),
          ],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("OVER_RESERVATION_BLOCKED");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [
            makeReservation({
              expiresAt: new Date(BASE_NOW - MINUTE).toISOString(),
              canRefresh: false,
              canRevalidate: false,
              canCancel: true,
            }),
          ],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("RESERVATION_EXPIRED_LOCKED");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [
            makeReservation({
              expiresAt: new Date(BASE_NOW - MINUTE).toISOString(),
              canRefresh: true,
              canRevalidate: true,
            }),
          ],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("RESERVATION_EXPIRED_BLOCKED");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [
            makeReservation({
              expiresAt: new Date(BASE_NOW + 2 * MINUTE).toISOString(),
            }),
          ],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("RESERVATION_EXPIRING_SOON");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [makeReservation({ amount: "40,000.00" })],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("RESERVATION_LIQUIDITY_TIGHT");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("NO_ACTIVE_RESERVATIONS");

      expect(
        evaluateTreasuryReservationGuidance({
          availableBalance: 45000,
          projectedPayroll: 19500,
          reservations: [makeReservation({ amount: "15,000.00" })],
          now: BASE_NOW,
        }).reasonCode,
      ).toBe("RESERVATIONS_HEALTHY");
    });

    it("provides tailored per-reservation next steps for locked vs recoverable expired locks", () => {
      const expiredCancelOnly = describeSingleReservationGuidance(
        makeReservation({
          expiresAt: new Date(BASE_NOW - MINUTE).toISOString(),
          canRefresh: false,
          canRevalidate: false,
          canCancel: true,
        }),
        BASE_NOW,
      );
      expect(expiredCancelOnly.isRecoverable).toBe(false);
      expect(expiredCancelOnly.nextStep).toMatch(/Cancel to free the slot/i);

      const expiredLockedAll = describeSingleReservationGuidance(
        makeReservation({
          expiresAt: new Date(BASE_NOW - MINUTE).toISOString(),
          canRefresh: false,
          canRevalidate: false,
          canCancel: false,
        }),
        BASE_NOW,
      );
      expect(expiredLockedAll.nextStep).toMatch(/treasury administrator/i);

      const warningGuide = describeSingleReservationGuidance(
        makeReservation({
          expiresAt: new Date(BASE_NOW + 2 * MINUTE).toISOString(),
        }),
        BASE_NOW,
      );
      expect(warningGuide.status).toBe("warning");
      expect(warningGuide.nextStep).toMatch(/Click Refresh/i);

      // Corrupt amount cannot be fixed by Revalidate — advises Cancel instead
      const corruptAmountGuide = describeSingleReservationGuidance(
        makeReservation({ amount: "-500", canRevalidate: true, canCancel: true }),
        BASE_NOW,
      );
      expect(corruptAmountGuide.status).toBe("expired");
      expect(corruptAmountGuide.isRecoverable).toBe(false);
      expect(corruptAmountGuide.nextStep).toMatch(/Cancel this lock/i);

      // Corrupt timestamp only IS recoverable via Refresh even when Revalidate is false
      const corruptTsRefreshOnly = describeSingleReservationGuidance(
        makeReservation({
          expiresAt: "broken-ts",
          canRefresh: true,
          canRevalidate: false,
          canCancel: false,
        }),
        BASE_NOW,
      );
      expect(corruptTsRefreshOnly.isRecoverable).toBe(true);
      expect(corruptTsRefreshOnly.nextStep).toMatch(/Click Refresh/i);
    });

    it("rejects zero-amount locks and safely handles top-level null or tight empty liquidity", () => {
      const zeroLock = evaluateTreasuryReservationGuidance({
        availableBalance: 45000,
        projectedPayroll: 19500,
        reservations: [makeReservation({ amount: "0.00" })],
        now: BASE_NOW,
      });
      expect(zeroLock.reasonCode).toBe("INVALID_TREASURY_DATA");
      expect(zeroLock.counts.healthy).toBe(0);

      const tightEmpty = evaluateTreasuryReservationGuidance({
        availableBalance: 10000,
        projectedPayroll: 5000,
        newReservationAmount: "15000",
        reservations: [],
        now: BASE_NOW,
      });
      expect(tightEmpty.reasonCode).toBe("RESERVATION_LIQUIDITY_TIGHT");
      expect(tightEmpty.canCreateReservation).toBe(false);

      const nullTopLevel = evaluateTreasuryReservationGuidance(
        null as unknown as Parameters<typeof evaluateTreasuryReservationGuidance>[0],
      );
      expect(nullTopLevel.reasonCode).toBe("INVALID_TREASURY_DATA");
      expect(nullTopLevel.canExecutePayroll).toBe(false);
    });
  });

  describe("Zero-knowledge identifier sanitization & ReDoS resistance", () => {
    it("redacts Stellar StrKeys, muxed/contract keys, underscore IDs, 12-char commitments, BiDi overrides, and secrets near truncation boundary", () => {
      const syntheticPub = "G" + "A".repeat(55);
      const syntheticSecret = "S" + "B".repeat(55);
      const syntheticMuxed = "M" + "C".repeat(68);
      const syntheticContract = "C" + "D".repeat(55);
      const dirty = `BATCH_${syntheticPub}_END batch_emp\u200B_alice42 \u202Edev@zkpayroll.io 0xabc123def456 123-45-6789 ${syntheticMuxed} ${syntheticContract}`;
      const cleaned = sanitizeReservationIdentifier(dirty);

      expect(cleaned).not.toContain(syntheticPub);
      expect(cleaned).not.toContain(syntheticMuxed);
      expect(cleaned).not.toContain(syntheticContract);
      expect(cleaned).not.toContain("emp_alice42");
      expect(cleaned).not.toContain("dev@zkpayroll.io");
      expect(cleaned).not.toContain("0xabc123def456");
      expect(cleaned).not.toContain("123-45-6789");
      expect(cleaned).not.toContain("\u202E");
      expect(cleaned).not.toContain("\u200B");

      // Secret starting near char 230 must be redacted BEFORE final 256-char cap
      const paddedSecret = `${"x".repeat(230)} ${syntheticSecret}`;
      const cleanedPadded = sanitizeReservationIdentifier(paddedSecret);
      expect(cleanedPadded).not.toContain(syntheticSecret.slice(0, 16));

      expect(sanitizeReservationIdentifier("BATCH-ALPHA")).toBe("BATCH-ALPHA");
      expect(sanitizeReservationIdentifier("   ", "FALLBACK")).toBe("FALLBACK");
    });

    it("handles pathological long strings quickly without ReDoS backtracking", () => {
      const longHostile = "a".repeat(50_000) + "@";
      const start = performance.now();
      const result = sanitizeReservationIdentifier(longHostile);
      const elapsedMs = performance.now() - start;

      expect(result.length).toBeLessThanOrEqual(MAX_IDENTIFIER_LENGTH);
      expect(elapsedMs).toBeLessThan(50);
    });

    it("never leaks employee PII in serialized guidance output", () => {
      const guidance = evaluateTreasuryReservationGuidance({
        availableBalance: 45000,
        projectedPayroll: 19500,
        reservations: [makeReservation()],
        now: BASE_NOW,
      });
      const serialized = JSON.stringify(guidance);
      for (const emp of MOCK_EMPLOYEES) {
        expect(serialized).not.toContain(emp.name);
        expect(serialized).not.toContain(emp.id);
        expect(serialized).not.toContain(`$${emp.salary}`);
      }
    });
  });
});

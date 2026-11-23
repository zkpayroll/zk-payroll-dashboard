import type { AssetCode, TreasuryBalance } from "@/stores/treasury";

/**
 * Treasury reservation checks for payroll approval (#666).
 *
 * The treasury store (`stores/treasury.ts`) already tracks `available` vs.
 * `reserved` balances and exposes `reserveForPayroll`/`releaseReservation`,
 * but nothing in the payroll approval flow ever calls them — a batch moving
 * from "pending executive approval" to "approved" only checked the raw
 * treasury balance (`lib/treasury/readiness.ts`), never the *already
 * reserved* amount. That meant two payroll runs approved back-to-back, each
 * reading the same unreserved balance snapshot, could both pass a
 * sufficiency check and over-commit the treasury.
 *
 * This module is the pure gate the approval store consults before it calls
 * `reserveForPayroll`: it decides whether approving a draft of a given
 * amount would overdraw the asset's *available* (balance minus what is
 * already reserved for other in-flight runs) balance.
 */
export interface TreasuryReservationCheckResult {
  ok: boolean;
  /** Present only when `ok` is false. Payroll-value-free except the asset code. */
  reason?: string;
  assetCode: AssetCode;
  requestedAmount: number;
  availableBalance: number;
}

/**
 * Checks whether `amount` of `assetCode` can be reserved against `balance`
 * without overdrawing what is actually available (i.e. not already held by
 * another in-flight reservation).
 */
export function checkTreasuryReservation(
  balance: TreasuryBalance | undefined,
  assetCode: AssetCode,
  amount: number,
): TreasuryReservationCheckResult {
  if (!balance) {
    return {
      ok: false,
      reason: `No treasury balance is configured for ${assetCode}. Fund the treasury before approving this run.`,
      assetCode,
      requestedAmount: amount,
      availableBalance: 0,
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      reason: "The requested reservation amount must be a positive, finite number.",
      assetCode,
      requestedAmount: amount,
      availableBalance: balance.available,
    };
  }

  if (amount > balance.available) {
    return {
      ok: false,
      reason: `Approving this run would reserve more ${assetCode} than is currently available (other in-flight payroll runs already hold part of the treasury balance). Release or complete those runs, or top up the treasury, before approving.`,
      assetCode,
      requestedAmount: amount,
      availableBalance: balance.available,
    };
  }

  return {
    ok: true,
    assetCode,
    requestedAmount: amount,
    availableBalance: balance.available,
  };
}

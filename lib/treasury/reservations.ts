import type { AssetCode, TreasuryBalance } from "@/stores/treasury";
import { formatSupportedAssetsList, isSupportedAssetCode } from "@/lib/assets/supportedAssets";

/**
 * Treasury reservation checks for payroll approval (#666, #843).
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
 * already reserved for other in-flight runs) balance. It also validates and
 * explains unknown/unsupported asset codes before reservation.
 */
export interface TreasuryReservationCheckResult {
  ok: boolean;
  /** Present only when `ok` is false. Payroll-value-free except the asset code. */
  reason?: string;
  assetCode: AssetCode;
  requestedAmount: number;
  availableBalance: number;
  errorCode?: "UNKNOWN_ASSET_CODE" | "NO_BALANCE" | "INVALID_AMOUNT" | "INSUFFICIENT_BALANCE";
}

/**
 * Checks whether `amount` of `assetCode` can be reserved against `balance`
 * without overdrawing what is actually available (i.e. not already held by
 * another in-flight reservation). Also checks that `assetCode` is a supported
 * payroll asset before attempting reservation.
 */
export function checkTreasuryReservation(
  balance: TreasuryBalance | undefined,
  assetCode: AssetCode,
  amount: number,
): TreasuryReservationCheckResult {
  if (!assetCode || typeof assetCode !== "string" || !isSupportedAssetCode(assetCode)) {
    const supportedList = formatSupportedAssetsList();
    const rawCode = typeof assetCode === "string" ? assetCode.trim() : "";
    const displayCode = rawCode && /^[A-Z0-9_-]{1,32}$/i.test(rawCode) ? ` "${rawCode}"` : "";
    return {
      ok: false,
      errorCode: "UNKNOWN_ASSET_CODE",
      reason: `Unknown or unsupported asset code${displayCode}. Treasury reservation requires a supported payroll asset (${supportedList}). Configure or select a supported asset before reserving funds.`,
      assetCode: assetCode ?? "",
      requestedAmount: Number.isFinite(amount) ? amount : 0,
      availableBalance: balance?.available ?? 0,
    };
  }

  if (!balance) {
    return {
      ok: false,
      errorCode: "NO_BALANCE",
      reason: `No treasury balance is configured for ${assetCode}. Fund the treasury before approving this run.`,
      assetCode,
      requestedAmount: amount,
      availableBalance: 0,
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      errorCode: "INVALID_AMOUNT",
      reason: "The requested reservation amount must be a positive, finite number.",
      assetCode,
      requestedAmount: amount,
      availableBalance: balance.available,
    };
  }

  if (amount > balance.available) {
    return {
      ok: false,
      errorCode: "INSUFFICIENT_BALANCE",
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

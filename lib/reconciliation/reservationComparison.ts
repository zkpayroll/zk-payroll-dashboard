/**
 * Compares the final payout total of a payroll run against the amount that was
 * reserved for it (#860).
 *
 * Privacy rule: this module only ever sees aggregate figures — one reserved
 * total and one final payout total per asset. It never accepts a per-employee
 * salary or payment, and its messages contain only the asset code and those
 * totals.
 *
 * Amounts are compared in the smallest Stellar unit (1e-7), so floating point
 * noise such as 0.1 + 0.2 never shows up as a mismatch.
 */

export type ReservationComparisonStatus =
  /** Final payout equals the reservation. */
  | "matched"
  /** Reservation is larger than the final payout: the excess should be released. */
  | "over_reserved"
  /** Final payout exceeds the reservation: part of the payout is unfunded. */
  | "under_reserved"
  /** There is a payout but no reservation figure to compare it with. */
  | "no_reservation"
  /** An amount is missing, negative, or not a finite number. */
  | "invalid";

export interface ReservationComparison {
  status: ReservationComparisonStatus;
  assetCode: string;
  reserved: number | null;
  finalPayout: number | null;
  /** finalPayout - reserved. Positive means unfunded, negative means excess. */
  difference: number;
  /** Actionable, privacy-safe explanation. */
  message: string;
}

const UNITS_PER_AMOUNT = 10_000_000;

function isUsableAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toUnits(value: number): number {
  return Math.round(value * UNITS_PER_AMOUNT);
}

export function formatReservationAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

/**
 * @param reserved Total reserved for the asset, or `undefined` when no
 *   reservation was recorded.
 * @param finalPayout Final payout total for the asset.
 */
export function compareReservedToPayout(
  assetCode: string,
  reserved: number | undefined | null,
  finalPayout: number,
): ReservationComparison {
  if (!isUsableAmount(finalPayout) || (reserved != null && !isUsableAmount(reserved))) {
    return {
      status: "invalid",
      assetCode,
      reserved: reserved ?? null,
      finalPayout: Number.isFinite(finalPayout) ? finalPayout : null,
      difference: 0,
      message: `${assetCode}: the reserved or final payout total is missing or invalid, so it cannot be compared. Refresh the run totals and try again.`,
    };
  }

  if (reserved == null) {
    return {
      status: finalPayout === 0 ? "matched" : "no_reservation",
      assetCode,
      reserved: null,
      finalPayout,
      difference: finalPayout,
      message:
        finalPayout === 0
          ? `${assetCode}: nothing to pay out and nothing reserved.`
          : `${assetCode}: final payout of ${formatReservationAmount(finalPayout)} has no recorded reservation. Reserve the funds before closing the period.`,
    };
  }

  const diffUnits = toUnits(finalPayout) - toUnits(reserved);
  const difference = diffUnits / UNITS_PER_AMOUNT;

  if (diffUnits === 0) {
    return {
      status: "matched",
      assetCode,
      reserved,
      finalPayout,
      difference: 0,
      message: `${assetCode}: final payout matches the ${formatReservationAmount(reserved)} reserved.`,
    };
  }

  if (diffUnits > 0) {
    return {
      status: "under_reserved",
      assetCode,
      reserved,
      finalPayout,
      difference,
      message: `${assetCode}: final payout of ${formatReservationAmount(finalPayout)} exceeds the ${formatReservationAmount(reserved)} reserved by ${formatReservationAmount(difference)}. Increase the reservation before settling.`,
    };
  }

  return {
    status: "over_reserved",
    assetCode,
    reserved,
    finalPayout,
    difference,
    message: `${assetCode}: ${formatReservationAmount(-difference)} of the ${formatReservationAmount(reserved)} reserved is not needed by the final payout of ${formatReservationAmount(finalPayout)}. Release the excess reservation.`,
  };
}

/**
 * Pure treasury reservation guidance evaluator (#887).
 *
 * Evaluates treasury liquidity, active/expiring/expired reservation locks,
 * permission boundaries (refresh / revalidate / cancel), and over-reservation
 * thresholds using exact 7-decimal BigInt stroop arithmetic.
 *
 * Privacy guarantee:
 * Never exposes employee names, employee IDs, individual salary figures, raw
 * Stellar keys, or cryptographic secrets. Only aggregated treasury balances,
 * public asset codes, and sanitized batch/reservation identifiers are surfaced.
 */

import { formatTreasuryAmount } from "@/lib/treasury/liquidityReserve";
import {
  RESERVATION_WARNING_WINDOW_MS,
  getReservationStatus,
  type FundingReservation,
} from "@/stores/reservations";
import type {
  ParsedReservationAmountResult,
  ReservationGuidanceCounts,
  ReservationGuidanceReasonCode,
  ReservationGuidanceTone,
  SingleReservationGuidance,
  TreasuryReservationActionGuide,
  TreasuryReservationGuidance,
  TreasuryReservationGuidanceInput,
} from "@/types/treasury";

export type {
  ParsedReservationAmountResult,
  ReservationGuidanceCounts,
  ReservationGuidanceReasonCode,
  ReservationGuidanceTone,
  SingleReservationGuidance,
  TreasuryReservationActionGuide,
  TreasuryReservationGuidance,
  TreasuryReservationGuidanceInput,
};

export const DEFAULT_NEW_RESERVATION_AMOUNT = "15000";
export const MAX_IDENTIFIER_LENGTH = 256;
const MAX_SANITIZE_SCAN_LENGTH = 4096;

const STROOP_DECIMALS = 7;
const STROOPS_PER_UNIT = BigInt(10 ** STROOP_DECIMALS);
const ZERO_UNITS = BigInt(0);

const PLAIN_DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,7})?$/;
const COMMA_GROUPED_DECIMAL_PATTERN = /^\d{1,3}(?:,\d{3}){0,5}(?:\.\d{1,7})?$/;
const NEGATIVE_PREFIX_PATTERN = /^(?:-\s*\$?\s*(?:\d|\.)|\$\s*-\s*(?:\d|\.))+/;

// Control, C1, BiDi override/isolate, and zero-width characters.
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]+/g;
const CONTROL_AND_BIDI_PATTERN =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]+/g;

// Bounded O(n) PII/secret redaction patterns (safe against backtracking and underscore boundaries).
const STELLAR_STRKEY_PATTERN =
  /(^|[^A-Za-z0-9])(?:M[A-Z2-7]{68}|[CGSTXL][A-Z2-7]{55})(?=$|[^A-Za-z0-9])/g;
const EMPLOYEE_ID_PATTERN =
  /(^|[^A-Za-z0-9])emp_[a-zA-Z0-9-]{1,64}(?=$|[^A-Za-z0-9])/gi;
const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,253}\.[a-zA-Z]{2,24}/g;
const JWT_PATTERN =
  /(^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,128}\.[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}(?=$|[^A-Za-z0-9_-])/g;
const URL_SECRET_QUERY_PATTERN =
  /([?&](?:token|key|secret|auth|sig|apikey)=)[^&#\s]{1,128}/gi;
const HEX_HASH_PATTERN =
  /(^|[^A-Za-z0-9])0x[a-fA-F0-9]{12,128}(?=$|[^A-Za-z0-9])/g;
const SSN_PATTERN = /(^|[^0-9])\d{3}-\d{2}-\d{4}(?=$|[^0-9])/g;
const PHONE_PATTERN =
  /(^|[^0-9])(?:\+1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}(?=$|[^0-9])/g;
const LABELED_COMP_PATTERN =
  /\$\s?\d{1,12}(?:,\d{3}){0,4}(?:\.\d{1,2})?\s*(?:\/\s*(?:yr|year|mo|month|hr|hour)|salary)\b/gi;

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/**
 * Parses a numeric or decimal string (plain or strictly thousands-comma formatted,
 * with optional leading `$`) into 7-decimal integer stroops using BigInt.
 */
export function parseReservationAmountUnits(
  value: unknown,
): ParsedReservationAmountResult {
  if (value === null || value === undefined) {
    return { ok: false, reason: "missing" };
  }

  let normalizedText: string;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, reason: "invalid" };
    }
    if (value < 0) {
      return { ok: false, reason: "negative" };
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      return { ok: false, reason: "invalid" };
    }
    if (value > 0 && value < 1e-7) {
      return { ok: false, reason: "invalid" };
    }
    normalizedText = value.toFixed(STROOP_DECIMALS);
  } else if (typeof value === "string") {
    let trimmed = value.trim();
    if (trimmed === "") {
      return { ok: false, reason: "missing" };
    }
    if (NEGATIVE_PREFIX_PATTERN.test(trimmed)) {
      return { ok: false, reason: "negative" };
    }
    if (trimmed.startsWith("$")) {
      trimmed = trimmed.slice(1).trim();
    }
    if (
      !PLAIN_DECIMAL_PATTERN.test(trimmed) &&
      !COMMA_GROUPED_DECIMAL_PATTERN.test(trimmed)
    ) {
      return { ok: false, reason: "invalid" };
    }
    normalizedText = trimmed.replace(/,/g, "");
  } else {
    return { ok: false, reason: "invalid" };
  }

  const parts = normalizedText.match(/^(\d+)(?:\.(\d+))?$/);
  if (!parts) {
    return { ok: false, reason: "invalid" };
  }

  const [, whole, fraction = ""] = parts;
  return {
    ok: true,
    units:
      BigInt(whole) * STROOPS_PER_UNIT +
      BigInt(fraction.padEnd(STROOP_DECIMALS, "0")),
  };
}

/** Converts non-negative 7-decimal stroops to a canonical ungrouped decimal string. */
export function unitsToPlainDecimal(units: bigint): string {
  const safeUnits = units < ZERO_UNITS ? ZERO_UNITS : units;
  const whole = safeUnits / STROOPS_PER_UNIT;
  const fraction = (safeUnits % STROOPS_PER_UNIT)
    .toString()
    .padStart(STROOP_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
}

/** Formats 7-decimal stroop units for operator display without float conversion. */
export function formatReservationUnits(units: bigint): string {
  return formatTreasuryAmount(unitsToPlainDecimal(units));
}

/**
 * Redacts accidental PII or secrets from public batch, reservation, or asset identifiers
 * using bounded linear-time patterns, BiDi/control stripping, and redaction-before-truncation.
 */
export function sanitizeReservationIdentifier(
  value: string | null | undefined,
  fallback = "UNSPECIFIED",
): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const stripped = value
    .slice(0, MAX_SANITIZE_SCAN_LENGTH)
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(CONTROL_AND_BIDI_PATTERN, " ")
    .trim();
  if (stripped === "") {
    return fallback;
  }
  const sanitized = stripped
    .replace(STELLAR_STRKEY_PATTERN, "$1[REDACTED-KEY]")
    .replace(EMPLOYEE_ID_PATTERN, "$1[REDACTED-EMP]")
    .replace(EMAIL_PATTERN, "[REDACTED-EMAIL]")
    .replace(JWT_PATTERN, "$1[REDACTED-TOKEN]")
    .replace(URL_SECRET_QUERY_PATTERN, "$1[REDACTED]")
    .replace(HEX_HASH_PATTERN, "$1[REDACTED-HASH]")
    .replace(SSN_PATTERN, "$1[REDACTED-ID]")
    .replace(PHONE_PATTERN, "$1[REDACTED-ID]")
    .replace(LABELED_COMP_PATTERN, "[REDACTED-COMP]")
    .slice(0, MAX_IDENTIFIER_LENGTH)
    .trim();
  return sanitized === "" ? fallback : sanitized;
}

export function normalizeAssetCode(assetCode: string | null | undefined): string {
  const cleaned = sanitizeReservationIdentifier(assetCode, "USDC")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  return cleaned === "" ? "USDC" : cleaned.slice(0, 12);
}

/** Static action reference guide explaining reservation controls without side effects. */
export function getReservationActionGuides(): TreasuryReservationActionGuide[] {
  return [
    {
      action: "reserve",
      label: "Reserve Funds",
      whenToUse: "Before submitting payroll approval or on-chain settlement.",
      effect:
        "Earmarks treasury liquidity for a 15-minute lock window so concurrent runs cannot double-spend it.",
    },
    {
      action: "refresh",
      label: "Refresh",
      whenToUse: "When a lock enters the 5-minute warning window or expires while refresh is enabled.",
      effect:
        "Extends expiresAt by a fresh 15-minute TTL while preserving the original reservation timestamp.",
    },
    {
      action: "revalidate",
      label: "Revalidate",
      whenToUse: "When treasury balances changed or a lock needs a newly anchored TTL.",
      effect:
        "Re-confirms backing liquidity and resets both reservedAt and expiresAt to a new 15-minute window.",
    },
    {
      action: "cancel",
      label: "Cancel",
      whenToUse: "When a batch is postponed, duplicated, or locked after expiry with refresh disabled.",
      effect:
        "Removes the lock immediately and returns the earmarked funds to unreserved treasury liquidity.",
    },
  ];
}

function hasValidTimestamp(expiresAt: unknown): boolean {
  if (typeof expiresAt !== "string" || expiresAt.trim() === "") {
    return false;
  }
  const ms = new Date(expiresAt).getTime();
  return Number.isFinite(ms);
}

function hasValidPositiveAmount(amount: unknown): boolean {
  const parsed = parseReservationAmountUnits(amount);
  return parsed.ok && parsed.units > ZERO_UNITS;
}

/** Safely validates and deduplicates reservation lists for stores and UI components. */
export function deduplicateInputReservations(
  raw: FundingReservation[] | null | undefined,
): { items: FundingReservation[]; corruptEntries: number } {
  if (!Array.isArray(raw)) {
    return { items: [], corruptEntries: raw === null || raw === undefined ? 0 : 1 };
  }
  const indexById = new Map<string, number>();
  const items: FundingReservation[] = [];
  let corruptEntries = 0;

  for (const entry of raw) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      entry.id.trim() === ""
    ) {
      corruptEntries += 1;
      continue;
    }
    const existingIdx = indexById.get(entry.id);
    if (existingIdx !== undefined) {
      items[existingIdx] = entry;
    } else {
      indexById.set(entry.id, items.length);
      items.push(entry);
    }
  }

  return { items, corruptEntries };
}

/** Produces per-reservation operational guidance respecting expiry state and permissions. */
export function describeSingleReservationGuidance(
  reservation: FundingReservation,
  now: number = Date.now(),
  warningWindowMs: number = RESERVATION_WARNING_WINDOW_MS,
): SingleReservationGuidance {
  const validTimestamp = hasValidTimestamp(reservation?.expiresAt);
  const validAmount = hasValidPositiveAmount(reservation?.amount);
  const validAsset =
    typeof reservation?.asset === "string" && reservation.asset.trim() !== "";
  const hasCorruptData = !validTimestamp || !validAmount || !validAsset;

  const status = getReservationStatus(reservation, now, warningWindowMs);
  const canRefresh = Boolean(reservation?.canRefresh);
  const canRevalidate = Boolean(reservation?.canRevalidate);
  const canCancel = Boolean(reservation?.canCancel);

  if (hasCorruptData) {
    // Amount/asset corruption cannot be repaired in place by Refresh/Revalidate.
    if (!validAmount || !validAsset) {
      if (canCancel) {
        return {
          status: "expired",
          headline: "Corrupted reservation amount or asset detected",
          nextStep:
            "Reservation amount or asset is invalid and fails closed. Cancel this lock and create a new reservation from the treasury workflow.",
          isRecoverable: false,
          hasCorruptData: true,
        };
      }
      return {
        status: "expired",
        headline: "Locked reservation has invalid amount or asset",
        nextStep:
          "This lock carries invalid amount or asset metadata and cannot be cancelled here. Contact a treasury administrator to replace it.",
        isRecoverable: false,
        hasCorruptData: true,
      };
    }

    // Only timestamp is corrupt — Refresh or Revalidate can issue a valid TTL.
    if (canRefresh || canRevalidate) {
      const actionLabel =
        canRefresh && canRevalidate
          ? "Refresh or Revalidate"
          : canRefresh
            ? "Refresh"
            : "Revalidate";
      return {
        status: "expired",
        headline: "Corrupted reservation timestamp detected",
        nextStep: `Reservation expiry timestamp is invalid and fails closed. Click ${actionLabel} to issue a clean 15-minute lock, or Cancel to release it.`,
        isRecoverable: true,
        hasCorruptData: true,
      };
    }
    if (canCancel) {
      return {
        status: "expired",
        headline: "Corrupted reservation timestamp detected",
        nextStep:
          "Reservation expiry timestamp is invalid and fails closed. Cancel this lock and create a new reservation from the payroll workflow.",
        isRecoverable: false,
        hasCorruptData: true,
      };
    }
    return {
      status: "expired",
      headline: "Locked reservation has invalid timestamp",
      nextStep:
        "This lock has an invalid timestamp and all self-service recovery controls are disabled. Contact a treasury administrator to replace it.",
      isRecoverable: false,
      hasCorruptData: true,
    };
  }

  if (status === "expired") {
    if (canRefresh && canRevalidate) {
      return {
        status,
        headline: "Expired lock blocks settlement",
        nextStep:
          "Click Refresh to extend the TTL or Revalidate to reset the reservation window before executing payroll.",
        isRecoverable: true,
        hasCorruptData: false,
      };
    }
    if (canRefresh) {
      return {
        status,
        headline: "Expired lock can be refreshed",
        nextStep: "Click Refresh to restore a 15-minute execution window for this batch.",
        isRecoverable: true,
        hasCorruptData: false,
      };
    }
    if (canRevalidate) {
      return {
        status,
        headline: "Expired lock requires revalidation",
        nextStep: "Click Revalidate to re-anchor this reservation before executing payroll.",
        isRecoverable: true,
        hasCorruptData: false,
      };
    }
    if (canCancel) {
      return {
        status,
        headline: "Expired lock cannot be renewed in place",
        nextStep:
          "Refresh and Revalidate are disabled for this lock. Click Cancel to free the slot, then create a fresh reservation.",
        isRecoverable: false,
        hasCorruptData: false,
      };
    }
    return {
      status,
      headline: "Expired lock requires administrator action",
      nextStep:
        "All self-service actions are disabled on this expired lock. Ask a treasury administrator to unlock or replace the batch.",
      isRecoverable: false,
      hasCorruptData: false,
    };
  }

  if (status === "warning") {
    const extensionAction = canRefresh
      ? "Click Refresh to extend the TTL by 15 minutes"
      : canRevalidate
        ? "Click Revalidate to reset the 15-minute window"
        : "Submit execution immediately before the countdown reaches zero";
    return {
      status,
      headline: "Reservation approaching expiry",
      nextStep: `Execution remains open until the timer hits zero. ${extensionAction} to avoid contract rejection.`,
      isRecoverable: canRefresh || canRevalidate,
      hasCorruptData: false,
    };
  }

  return {
    status,
    headline: "Reservation lock active and backed",
    nextStep: canCancel
      ? "Lock is ready for payroll settlement. Use Cancel if this cycle is rescheduled to release funds early."
      : "Lock is active and protected against double-allocation until settlement completes.",
    isRecoverable: true,
    hasCorruptData: false,
  };
}

/**
 * Evaluates full treasury reservation state and returns structured, privacy-safe
 * guidance for operators. Pure function: never throws, never mutates inputs.
 */
export function evaluateTreasuryReservationGuidance(
  input: TreasuryReservationGuidanceInput,
): TreasuryReservationGuidance {
  const safeInput: TreasuryReservationGuidanceInput =
    input && typeof input === "object" ? input : {};

  const actionGuides = getReservationActionGuides();
  const assetCode = normalizeAssetCode(safeInput.assetCode);
  const effectiveNow =
    typeof safeInput.now === "number" && Number.isFinite(safeInput.now)
      ? safeInput.now
      : Date.now();
  const safeWarningWindow =
    typeof safeInput.warningWindowMs === "number" &&
    Number.isFinite(safeInput.warningWindowMs) &&
    safeInput.warningWindowMs >= 0
      ? safeInput.warningWindowMs
      : RESERVATION_WARNING_WINDOW_MS;

  const { items, corruptEntries } = deduplicateInputReservations(
    safeInput.reservations,
  );

  const parsedAvailable = parseReservationAmountUnits(safeInput.availableBalance);
  const parsedProjected = parseReservationAmountUnits(safeInput.projectedPayroll);

  const hasSafetyBuffer =
    safeInput.safetyBuffer !== null && safeInput.safetyBuffer !== undefined;
  const parsedSafetyBuffer = hasSafetyBuffer
    ? parseReservationAmountUnits(safeInput.safetyBuffer)
    : ({ ok: true, units: ZERO_UNITS } as const);

  const rawNewAmount = safeInput.newReservationAmount ?? DEFAULT_NEW_RESERVATION_AMOUNT;
  const parsedNewAmount = parseReservationAmountUnits(rawNewAmount);
  const validNewAmount = parsedNewAmount.ok && parsedNewAmount.units > ZERO_UNITS;

  const counts: ReservationGuidanceCounts = {
    total: items.length,
    healthy: 0,
    warning: 0,
    expired: 0,
    lockedExpired: 0,
    invalid: corruptEntries,
  };

  let activeReservedUnits = ZERO_UNITS;

  for (const reservation of items) {
    const validTs = hasValidTimestamp(reservation.expiresAt);
    const parsedAmt = parseReservationAmountUnits(reservation.amount);
    const validAmt = parsedAmt.ok && parsedAmt.units > ZERO_UNITS;
    const validAsset =
      typeof reservation.asset === "string" && reservation.asset.trim() !== "";
    const isCorruptItem = !validTs || !validAmt || !validAsset;

    if (isCorruptItem) {
      counts.invalid += 1;
      counts.expired += 1;
      if (!reservation.canRefresh && !reservation.canRevalidate) {
        counts.lockedExpired += 1;
      }
      continue;
    }

    const status = getReservationStatus(reservation, effectiveNow, safeWarningWindow);
    if (status === "expired") {
      counts.expired += 1;
      if (!reservation.canRefresh && !reservation.canRevalidate) {
        counts.lockedExpired += 1;
      }
    } else if (status === "warning") {
      counts.warning += 1;
    } else {
      counts.healthy += 1;
    }

    if (status !== "expired" && parsedAmt.ok) {
      const itemAsset = normalizeAssetCode(reservation.asset);
      if (itemAsset === assetCode) {
        activeReservedUnits += parsedAmt.units;
      }
    }
  }

  const availableUnits = parsedAvailable.ok ? parsedAvailable.units : ZERO_UNITS;
  const projectedUnits = parsedProjected.ok ? parsedProjected.units : ZERO_UNITS;
  const safetyBufferUnits = parsedSafetyBuffer.ok ? parsedSafetyBuffer.units : ZERO_UNITS;
  const newReservationUnits = validNewAmount ? parsedNewAmount.units : ZERO_UNITS;

  const unreservedUnits =
    availableUnits > activeReservedUnits ? availableUnits - activeReservedUnits : ZERO_UNITS;

  const formattedAvailableBalance = parsedAvailable.ok
    ? `${formatReservationUnits(availableUnits)} ${assetCode}`
    : "Unavailable";
  const formattedActiveReserved = `${formatReservationUnits(activeReservedUnits)} ${assetCode}`;
  const formattedUnreservedBalance = parsedAvailable.ok
    ? `${formatReservationUnits(unreservedUnits)} ${assetCode}`
    : "Unavailable";

  const hasInvalidInputs =
    !parsedAvailable.ok ||
    !parsedProjected.ok ||
    !parsedSafetyBuffer.ok ||
    !validNewAmount ||
    counts.invalid > 0;

  const canCreateNewLock =
    safeInput.hasConfiguredAssets !== false &&
    !hasInvalidInputs &&
    projectedUnits <= availableUnits &&
    activeReservedUnits <= availableUnits &&
    unreservedUnits >= newReservationUnits;

  // 1. Missing configured payroll assets
  if (safeInput.hasConfiguredAssets === false) {
    return {
      tone: "blocked",
      reasonCode: "ASSETS_UNCONFIGURED",
      badgeLabel: "Execution blocked",
      title: "Configure Supported Assets Before Reserving Funds",
      summary: "No supported Stellar payroll assets are configured for this treasury.",
      guidance:
        "Reservations cannot lock liquidity until at least one Stellar payroll asset (such as USDC or XLM) is enabled in asset settings.",
      nextSteps: [
        "Open Asset Settings and enable a supported Stellar payroll asset",
        "Verify treasury funding exists for the selected asset",
        "Return to Treasury to reserve funds for upcoming payroll batches",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: false,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
      remediationHref: "/settings/assets",
      remediationLabel: "Configure Payroll Assets",
    };
  }

  // 2. Fail closed on malformed/negative balances or corrupt reservation records
  if (hasInvalidInputs) {
    return {
      tone: "blocked",
      reasonCode: "INVALID_TREASURY_DATA",
      badgeLabel: "Data issue",
      title: "Treasury or Reservation Data Needs Verification",
      summary:
        "One or more treasury readings or reservation locks contain invalid or malformed values.",
      guidance:
        "Payroll execution and new reservations fail closed when balances, projections, timestamps, assets, or lock amounts cannot be verified deterministically.",
      nextSteps: [
        "Refresh treasury balances and verify projected payroll amounts are non-negative",
        "Revalidate or cancel any reservation carrying corrupted timestamps or amounts",
        "Confirm active locks match unreserved liquidity before executing settlement",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: false,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 3. Projected payroll exceeds total available balance
  if (projectedUnits > availableUnits) {
    const deficitUnits = projectedUnits - availableUnits;
    return {
      tone: "blocked",
      reasonCode: "INSUFFICIENT_TREASURY_BALANCE",
      badgeLabel: "Execution blocked",
      title: "Insufficient Treasury Balance for Projected Payroll",
      summary: `Projected ${assetCode} payroll exceeds available balance by ${formatReservationUnits(deficitUnits)} ${assetCode}.`,
      guidance:
        "Creating new locks or running payroll is blocked because total treasury liquidity cannot cover the scheduled cycle.",
      nextSteps: [
        `Deposit at least ${formatReservationUnits(deficitUnits)} ${assetCode} into the treasury account`,
        "Confirm updated balance arrives above projected payroll requirements",
        "Create a fresh funding reservation before submitting execution",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: false,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
      remediationHref: "/treasury",
      remediationLabel: "Fund Treasury",
    };
  }

  // 4. Active reservations already exceed available balance (over-reservation)
  if (activeReservedUnits > availableUnits) {
    const excessUnits = activeReservedUnits - availableUnits;
    return {
      tone: "blocked",
      reasonCode: "OVER_RESERVATION_BLOCKED",
      badgeLabel: "Over-reserved",
      title: "Active Reservations Exceed Available Treasury Balance",
      summary: `Active ${assetCode} reservations exceed available treasury funds by ${formatReservationUnits(excessUnits)} ${assetCode}.`,
      guidance:
        "Cumulative active reservations exceed backing liquidity. Release or cancel unneeded locks or add treasury funds before creating new locks or settling payroll.",
      nextSteps: [
        "Cancel stale or duplicate batch reservations below to free unreserved balance",
        `Or top up treasury liquidity by at least ${formatReservationUnits(excessUnits)} ${assetCode}`,
        "Verify unreserved balance returns to zero or positive before executing payroll",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: false,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 5. Expired locks where refresh AND revalidate are both disabled
  if (counts.lockedExpired > 0) {
    return {
      tone: "blocked",
      reasonCode: "RESERVATION_EXPIRED_LOCKED",
      badgeLabel: "Execution blocked",
      title: "Locked Expired Reservation Prevents Payroll Execution",
      summary: `${counts.lockedExpired} expired ${pluralize(counts.lockedExpired, "reservation")} cannot be refreshed or revalidated in place.`,
      guidance:
        "Because direct TTL renewal is disabled on the expired lock, cancel it (if permitted) to reclaim your slot and reserve a new lock, or ask a treasury administrator to unlock it.",
      nextSteps: [
        "Click Cancel on non-renewable expired locks to clear the blocked batch",
        "Create a fresh reservation once unreserved liquidity is available",
        "If Cancel is also disabled, request administrator intervention before payroll execution",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: canCreateNewLock,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 6. Standard expired reservations (refresh/revalidate available)
  if (counts.expired > 0) {
    return {
      tone: "blocked",
      reasonCode: "RESERVATION_EXPIRED_BLOCKED",
      badgeLabel: "Execution blocked",
      title: "Expired Funding Reservations Must Be Renewed",
      summary: `${counts.expired} ${pluralize(counts.expired, "reservation")} passed the TTL deadline and blocks on-chain settlement.`,
      guidance:
        "On-chain settlement rejects expired funding holds to prevent double-spending. Renew the lock window or remove obsolete batches before proceeding.",
      nextSteps: [
        "Use Refresh on expired reservations to add a new 15-minute TTL window",
        "Use Revalidate if balances changed so reservedAt and expiresAt re-anchor together",
        "Cancel any obsolete batch locks you no longer plan to execute",
      ],
      actionGuides,
      canExecutePayroll: false,
      canCreateReservation: canCreateNewLock,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 7. Warning window (expiring within 5 minutes)
  if (counts.warning > 0) {
    return {
      tone: "warning",
      reasonCode: "RESERVATION_EXPIRING_SOON",
      badgeLabel: "Refresh recommended",
      title: "Funding Reservations Entering Expiry Window",
      summary: `${counts.warning} active ${pluralize(counts.warning, "lock")} inside the 5-minute warning window.`,
      guidance:
        "Payroll execution is still permitted until the countdown reaches zero, but extending the TTL now prevents unexpected contract submission failures.",
      nextSteps: [
        "Click Refresh on near-expiry batches to reset the 15-minute countdown",
        "Or proceed directly to payroll execution if signing can finish before expiry",
        "Keep at least one active non-expired lock until transaction settlement confirms",
      ],
      actionGuides,
      canExecutePayroll: true,
      canCreateReservation: canCreateNewLock,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
      remediationHref: "/payroll/execute",
      remediationLabel: "Open Payroll Execution",
    };
  }

  // 8. Tight remaining unreserved capacity / buffer warning (for both active and empty states)
  const breachesSafetyBuffer =
    safetyBufferUnits > ZERO_UNITS && unreservedUnits < safetyBufferUnits;
  if (!canCreateNewLock || breachesSafetyBuffer) {
    const requestedLabel = `${formatReservationUnits(newReservationUnits)} ${assetCode}`;
    const summaryText =
      counts.total > 0
        ? `Existing ${assetCode} locks leave ${formattedUnreservedBalance} unreserved.`
        : `Available unreserved balance (${formattedUnreservedBalance}) is below the ${requestedLabel} reservation target or safety buffer.`;
    return {
      tone: "warning",
      reasonCode: "RESERVATION_LIQUIDITY_TIGHT",
      badgeLabel: "Capacity notice",
      title: "Remaining Unreserved Liquidity Is Low",
      summary: summaryText,
      guidance:
        counts.total > 0
          ? "Current active reservations are valid for scheduled execution, but remaining unreserved liquidity cannot accommodate another full lock or safety buffer."
          : `No active locks exist yet, and current unreserved liquidity cannot cover a ${requestedLabel} reservation or configured safety buffer.`,
      nextSteps:
        counts.total > 0
          ? [
              "Execute pending healthy reservations or cancel unused batch holds",
              `Add ${assetCode} funds before creating additional concurrent reservations`,
              "Verify multi-asset readiness thresholds before scheduling extra runs",
            ]
          : [
              `Enter a smaller reservation amount within ${formattedUnreservedBalance}`,
              `Or deposit additional ${assetCode} funds into the treasury account`,
              "Verify treasury readiness before scheduling payroll execution",
            ],
      actionGuides,
      canExecutePayroll: true,
      canCreateReservation: canCreateNewLock,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 9. Empty state (no active reservations yet)
  if (counts.total === 0) {
    return {
      tone: "info",
      reasonCode: "NO_ACTIVE_RESERVATIONS",
      badgeLabel: "Setup guidance",
      title: "How Treasury Reservations Protect Payroll Runs",
      summary: `No ${assetCode} reservations currently lock part of your ${formattedAvailableBalance} balance.`,
      guidance:
        "Creating a funding reservation earmarks liquidity for 15 minutes so concurrent workflows cannot over-commit funds before on-chain settlement.",
      nextSteps: [
        "Enter a positive amount and click Reserve Funds below to lock treasury funds",
        "Monitor the 15-minute TTL and use Refresh inside the 5-minute warning window",
        "Cancel unused holds immediately to return funds to unreserved liquidity",
      ],
      actionGuides,
      canExecutePayroll: true,
      canCreateReservation: canCreateNewLock,
      assetCode,
      formattedAvailableBalance,
      formattedActiveReserved,
      formattedUnreservedBalance,
      counts,
    };
  }

  // 10. All reservations healthy and backed
  return {
    tone: "ready",
    reasonCode: "RESERVATIONS_HEALTHY",
    badgeLabel: "Active coverage",
    title: "Treasury Reservations Are Backed and Ready",
    summary:
      activeReservedUnits > ZERO_UNITS
        ? `${counts.healthy} active ${pluralize(counts.healthy, "lock")} (${formattedActiveReserved}) verified with ${formattedUnreservedBalance} remaining unreserved.`
        : `${counts.healthy} active ${pluralize(counts.healthy, "lock")} tracked across non-${assetCode} assets; ${formattedUnreservedBalance} remains unreserved.`,
    guidance:
      "All active funding reservations are inside their TTL window and backed by treasury liquidity without over-committing available funds.",
    nextSteps: [
      "Proceed to payroll execution while reservations remain active",
      "Use Refresh or Revalidate if operational approvals extend beyond 10 minutes",
      "Cancel a reservation if its batch is postponed so liquidity stays free",
    ],
    actionGuides,
    canExecutePayroll: true,
    canCreateReservation: canCreateNewLock,
    assetCode,
    formattedAvailableBalance,
    formattedActiveReserved,
    formattedUnreservedBalance,
    counts,
    remediationHref: "/payroll/execute",
    remediationLabel: "Proceed to Payroll Execution",
  };
}

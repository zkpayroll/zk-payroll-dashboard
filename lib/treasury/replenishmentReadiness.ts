import type { ShortfallAction } from "@/types/policy";
import type {
  TreasuryReplenishmentIssue,
  TreasuryReplenishmentIssueField,
  TreasuryReplenishmentPolicyInput,
  TreasuryReplenishmentReadinessResult,
  TreasuryReplenishmentSnapshot,
} from "@/types/treasury";
import { formatTreasuryAmount } from "@/lib/treasury/liquidityReserve";

/**
 * Dashboard Treasury Replenishment Readiness Analysis (#617).
 *
 * Reads the treasury balance together with the configured reserve policy and
 * reports whether the treasury should be replenished before the next payroll
 * run, how far it is from the policy target, and what the configured
 * shortfall policy does with a deficit.
 *
 * Money math runs on integer base units (7 decimals) so no comparison or
 * subtraction goes through floating point. The function never throws and
 * never reports a readiness status for unusable inputs.
 */

export const AMOUNT_DECIMALS = 7;
export const BASE_UNITS_PER_WHOLE = BigInt(10 ** AMOUNT_DECIMALS);
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_AMOUNT_REGEX = /^(\d+)(?:\.(\d+))?$/;

export const MIN_RESERVE_PERCENTAGE_MAX = 1000;
export const REPLENISH_THRESHOLD_PERCENTAGE_MAX = 100;

type AmountProblem = "missing" | "not_a_number" | "negative" | "too_precise" | "too_large";

type ParsedAmount =
  | { ok: true; units: bigint }
  | { ok: false; problem: AmountProblem };

function parseAmount(value: unknown): ParsedAmount {
  if (value === null || value === undefined) {
    return { ok: false, problem: "missing" };
  }

  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, problem: "not_a_number" };
    if (value < 0) return { ok: false, problem: "negative" };
    if (value > Number.MAX_SAFE_INTEGER) return { ok: false, problem: "too_large" };
    text = value.toFixed(AMOUNT_DECIMALS);
  } else if (typeof value === "string") {
    text = value.trim();
    if (text === "") return { ok: false, problem: "missing" };
    if (/^-\d+(\.\d+)?$/.test(text)) return { ok: false, problem: "negative" };
  } else {
    return { ok: false, problem: "not_a_number" };
  }

  const match = DECIMAL_AMOUNT_REGEX.exec(text);
  if (!match) return { ok: false, problem: "not_a_number" };

  const [, whole, fraction = ""] = match;
  if (fraction.length > AMOUNT_DECIMALS) return { ok: false, problem: "too_precise" };

  return {
    ok: true,
    units:
      BigInt(whole) * BASE_UNITS_PER_WHOLE +
      BigInt(fraction.padEnd(AMOUNT_DECIMALS, "0")),
  };
}

function unitsToDecimal(units: bigint): string {
  const whole = units / BASE_UNITS_PER_WHOLE;
  const fraction = (units % BASE_UNITS_PER_WHOLE)
    .toString()
    .padStart(AMOUNT_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

const FIELD_LABELS: Record<TreasuryReplenishmentIssueField, string> = {
  availableBalance: "treasury balance",
  nextPayrollObligation: "next payroll amount",
  reservePolicy: "reserve policy",
};

const FIELD_REMEDIATION: Record<TreasuryReplenishmentIssueField, string> = {
  availableBalance:
    "Refresh the reading; if it stays wrong, check the treasury account on the Treasury page.",
  nextPayrollObligation:
    "Refresh the reading; if it stays wrong, review the upcoming run on the Payroll schedule.",
  reservePolicy:
    "Open the payroll policy settings, review the reserve rules, and save a valid configuration.",
};

function describeProblem(field: TreasuryReplenishmentIssueField, problem: AmountProblem): string {
  const label = FIELD_LABELS[field];
  const remediation = FIELD_REMEDIATION[field];
  switch (problem) {
    case "missing":
      return `The ${label} is unavailable. ${remediation}`;
    case "negative":
      return `The ${label} is negative, which is not a valid reading. ${remediation}`;
    case "too_precise":
      return `The ${label} has more than ${AMOUNT_DECIMALS} decimal places, which Stellar assets do not support. ${remediation}`;
    case "too_large":
      return `The ${label} is too large to be evaluated safely. ${remediation}`;
    case "not_a_number":
      return `The ${label} is not a valid amount. ${remediation}`;
  }
}

function invalid(
  assetCode: string,
  issues: TreasuryReplenishmentIssue[],
): TreasuryReplenishmentReadinessResult {
  return { kind: "invalid", assetCode, issues };
}

function validatePolicy(
  policy: TreasuryReplenishmentPolicyInput,
): TreasuryReplenishmentIssue[] {
  const issues: TreasuryReplenishmentIssue[] = [];
  const { minReservePercentage, minReserveFixedAmount, replenishThresholdPercentage } = policy;

  if (
    typeof minReservePercentage !== "number" ||
    !Number.isFinite(minReservePercentage) ||
    minReservePercentage < 0 ||
    minReservePercentage > MIN_RESERVE_PERCENTAGE_MAX
  ) {
    issues.push({
      field: "reservePolicy",
      message: `The reserve policy min reserve percentage must be a number between 0 and ${MIN_RESERVE_PERCENTAGE_MAX}. ${FIELD_REMEDIATION.reservePolicy}`,
    });
  }

  const fixed = parseAmount(minReserveFixedAmount);
  if (!fixed.ok) {
    issues.push({
      field: "reservePolicy",
      message: `The reserve policy minimum fixed reserve is unusable. ${describeProblem("reservePolicy", fixed.problem)}`,
    });
  }

  if (
    typeof replenishThresholdPercentage !== "number" ||
    !Number.isFinite(replenishThresholdPercentage) ||
    replenishThresholdPercentage < 0 ||
    replenishThresholdPercentage > REPLENISH_THRESHOLD_PERCENTAGE_MAX
  ) {
    issues.push({
      field: "reservePolicy",
      message: `The replenish threshold must be a percentage between 0 and ${REPLENISH_THRESHOLD_PERCENTAGE_MAX}. ${FIELD_REMEDIATION.reservePolicy}`,
    });
  }

  return issues;
}

function percentOf(units: bigint, percent: number): bigint {
  const scaled = units * BigInt(Math.round(percent * 100));
  return scaled / (HUNDRED * BigInt(100));
}

function shortfallPolicyNote(shortfallPolicy: ShortfallAction): string {
  switch (shortfallPolicy) {
    case "block":
      return " Payroll is blocked by policy until the treasury is replenished.";
    case "require_approval":
      return " Policy requires a shortfall approval before payroll can continue.";
    case "warn":
      return " Policy flags the shortfall as a warning.";
  }
}

export function analyzeTreasuryReplenishmentReadiness(
  snapshot: TreasuryReplenishmentSnapshot,
): TreasuryReplenishmentReadinessResult {
  const assetCode =
    typeof snapshot?.assetCode === "string" && snapshot.assetCode.trim() !== ""
      ? snapshot.assetCode.trim()
      : "ASSET";

  const balance = parseAmount(snapshot?.availableBalance);
  if (!balance.ok) {
    return invalid(assetCode, [
      { field: "availableBalance", message: describeProblem("availableBalance", balance.problem) },
    ]);
  }

  const policy = snapshot?.policy;
  if (!policy) {
    return invalid(assetCode, [
      {
        field: "reservePolicy",
        message: `The reserve policy is unavailable, so replenishment readiness cannot be determined. ${FIELD_REMEDIATION.reservePolicy}`,
      },
    ]);
  }

  const policyIssues = validatePolicy(policy);
  if (policyIssues.length > 0) {
    return invalid(assetCode, policyIssues);
  }

  let obligation = ZERO;
  if (snapshot?.nextPayrollObligation !== null && snapshot?.nextPayrollObligation !== undefined) {
    const parsedObligation = parseAmount(snapshot.nextPayrollObligation);
    if (!parsedObligation.ok) {
      return invalid(assetCode, [
        {
          field: "nextPayrollObligation",
          message: describeProblem("nextPayrollObligation", parsedObligation.problem),
        },
      ]);
    }
    obligation = parsedObligation.units;
  }

  const minReserveFixed = parseAmount(policy.minReserveFixedAmount);
  const fromPercentage = percentOf(obligation, policy.minReservePercentage);
  const fixedUnits = minReserveFixed.ok ? minReserveFixed.units : ZERO;
  const target = fromPercentage > fixedUnits ? fromPercentage : fixedUnits;
  const threshold = percentOf(target, policy.replenishThresholdPercentage);

  const balanceUnits = balance.units;
  const shortfallPolicy = policy.shortfallPolicy ?? "warn";
  const assetLabel = assetCode;

  if (balanceUnits >= target) {
    return {
      kind: "evaluated",
      assetCode,
      status: "ready",
      balance: unitsToDecimal(balanceUnits),
      nextPayrollObligation: unitsToDecimal(obligation),
      targetReserveAmount: unitsToDecimal(target),
      replenishThresholdAmount: unitsToDecimal(threshold),
      shortfall: "0",
      topUpAmount: "0",
      shortfallPolicy,
      shouldReplenish: false,
      payrollBlocked: false,
      message: `Available balance meets the policy reserve target of ${formatTreasuryAmount(unitsToDecimal(target))} ${assetLabel}. No replenishment is needed.`,
    };
  }

  const topUp = target - balanceUnits;

  if (balanceUnits < obligation) {
    const shortfall = obligation - balanceUnits;
    return {
      kind: "evaluated",
      assetCode,
      status: "replenish_now",
      balance: unitsToDecimal(balanceUnits),
      nextPayrollObligation: unitsToDecimal(obligation),
      targetReserveAmount: unitsToDecimal(target),
      replenishThresholdAmount: unitsToDecimal(threshold),
      shortfall: unitsToDecimal(shortfall),
      topUpAmount: unitsToDecimal(topUp),
      shortfallPolicy,
      shouldReplenish: true,
      payrollBlocked: shortfallPolicy === "block",
      message: `Available balance cannot cover the next payroll run. Replenish at least ${formatTreasuryAmount(unitsToDecimal(shortfall))} ${assetLabel} before payroll executes.${shortfallPolicyNote(shortfallPolicy)}`,
    };
  }

  if (balanceUnits < threshold) {
    return {
      kind: "evaluated",
      assetCode,
      status: "replenish_now",
      balance: unitsToDecimal(balanceUnits),
      nextPayrollObligation: unitsToDecimal(obligation),
      targetReserveAmount: unitsToDecimal(target),
      replenishThresholdAmount: unitsToDecimal(threshold),
      shortfall: "0",
      topUpAmount: unitsToDecimal(topUp),
      shortfallPolicy,
      shouldReplenish: true,
      payrollBlocked: false,
      message: `Available balance is below the replenishment threshold of ${formatTreasuryAmount(unitsToDecimal(threshold))} ${assetLabel}. Replenish ${formatTreasuryAmount(unitsToDecimal(topUp))} ${assetLabel} to return to the policy target.`,
    };
  }

  return {
    kind: "evaluated",
    assetCode,
    status: "watch",
    balance: unitsToDecimal(balanceUnits),
    nextPayrollObligation: unitsToDecimal(obligation),
    targetReserveAmount: unitsToDecimal(target),
    replenishThresholdAmount: unitsToDecimal(threshold),
    shortfall: "0",
    topUpAmount: unitsToDecimal(topUp),
    shortfallPolicy,
    shouldReplenish: true,
    payrollBlocked: false,
    message: `Balance covers payroll but is below the policy reserve target of ${formatTreasuryAmount(unitsToDecimal(target))} ${assetLabel}. Replenish ${formatTreasuryAmount(unitsToDecimal(topUp))} ${assetLabel} to reach the target.`,
  };
}

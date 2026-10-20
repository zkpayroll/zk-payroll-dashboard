import {
  getSupportedAsset,
  isSupportedAssetCode,
  formatSupportedAssetsList,
} from "./supportedAssets";
import { validateAssetCode, validateAssetIssuer } from "./assetAvailabilitySafety";
import type {
  CompatiblePaymentAsset,
  PaymentAssetCompatibilityFinding,
  PaymentAssetCompatibilityResult,
  PaymentAssetCompatibilityStatus,
  PaymentAssetIssuerConflict,
  PaymentAssetTarget,
} from "@/types/assets";

/**
 * Thrown when a payroll run is attempted while payment asset compatibility is
 * not satisfied (issuers conflict, mismatch the supported token, or no
 * compatible payment asset remains).
 */
export class PaymentAssetCompatibilityError extends Error {
  public readonly result: PaymentAssetCompatibilityResult;

  constructor(message: string, result: PaymentAssetCompatibilityResult) {
    super(message);
    this.name = "PaymentAssetCompatibilityError";
    this.result = result;
  }
}

/** Key used to represent an unspecified (native) issuer in the grouping map. */
const NATIVE_ISSUER = Symbol("native");

/**
 * Pure evaluation function that assesses a set of intended payments against
 * payment-asset compatibility rules.
 *
 * Compatibility rules:
 *  - Each target's asset code must be valid and on the supported allowlist.
 *  - Issued assets must carry the supported canonical issuer (XLM is native and
 *    must not carry an issuer).
 *  - The same asset code must not resolve to two or more different issuers
 *    across targets — that would split payroll across incompatible tokens.
 *
 * Privacy-safe: operates strictly on asset codes, issuers, and opaque counts.
 * Never inspects employee identities, wallet addresses, balances, or amounts.
 */
export function evaluatePaymentAssetCompatibility(
  paymentTargets: unknown,
): PaymentAssetCompatibilityResult {
  const remediationAction = {
    label: "Review payroll asset settings",
    href: "/settings/assets",
  };
  const supportedList = formatSupportedAssetsList();

  // Nothing to validate → payroll cannot run.
  if (!Array.isArray(paymentTargets) || paymentTargets.length === 0) {
    return {
      status: "incompatible",
      canRunPayroll: false,
      compatibleAssets: [],
      unsupportedAssets: [],
      invalidTargets: [],
      issuerConflicts: [],
      issuerMismatches: [],
      summaryMessage: `Payment asset compatibility cannot be confirmed until employees are assigned a supported asset (${supportedList}).`,
      blockers: [
        `No payment targets were provided. Assign each employee a supported asset (${supportedList}) before running payroll.`,
      ],
      warnings: [],
      remediationAction,
    };
  }

  const invalidTargets: PaymentAssetCompatibilityFinding[] = [];
  const unsupportedAssets: string[] = [];
  const issuerMismatches: PaymentAssetCompatibilityFinding[] = [];
  const warnings: string[] = [];

  // code → distinct resolved issuers (NATIVE_ISSUER for native XLM).
  const issuersByCode = new Map<string, Set<string | typeof NATIVE_ISSUER>>();
  // code → display label.
  const labelsByCode = new Map<string, string>();
  // code → number of targets resolving to it.
  const countByCode = new Map<string, number>();
  // Supported codes, in first-seen order.
  const supportedCodes: string[] = [];

  paymentTargets.forEach((target, index) => {
    if (!target || typeof target !== "object") {
      invalidTargets.push({
        index,
        reason: "Payment target must be an object with an assetCode property.",
      });
      return;
    }

    const t = target as PaymentAssetTarget;

    const codeResult = validateAssetCode(t.assetCode);
    if (!codeResult.valid || !codeResult.normalized) {
      invalidTargets.push({
        index,
        assetCode: typeof t.assetCode === "string" ? t.assetCode : undefined,
        reason: codeResult.error ?? "Invalid asset code.",
      });
      return;
    }
    const code = codeResult.normalized;

    const issuerResult = validateAssetIssuer(code, t.assetIssuer);
    if (!issuerResult.valid) {
      invalidTargets.push({
        index,
        assetCode: code,
        reason: issuerResult.error ?? "Invalid asset issuer.",
      });
      return;
    }

    if (!isSupportedAssetCode(code)) {
      if (!unsupportedAssets.includes(code)) {
        unsupportedAssets.push(code);
      }
      return;
    }

    const canonical = getSupportedAsset(code);
    const canonicalIssuer = canonical?.issuer;
    const providedIssuer =
      typeof t.assetIssuer === "string" && t.assetIssuer.trim() !== ""
        ? t.assetIssuer.trim()
        : undefined;

    // Canonical issuer check: an issued asset must use the supported issuer so
    // recipients receive the expected token.
    if (canonicalIssuer && providedIssuer && providedIssuer !== canonicalIssuer) {
      issuerMismatches.push({
        index,
        assetCode: code,
        reason: `${code} is assigned with issuer ${providedIssuer}, which does not match the supported ${code} issuer. Recipients would receive an unrecognised token.`,
      });
    }

    const resolvedIssuer: string | typeof NATIVE_ISSUER =
      providedIssuer ?? canonicalIssuer ?? NATIVE_ISSUER;

    if (!issuersByCode.has(code)) {
      issuersByCode.set(code, new Set());
      labelsByCode.set(code, canonical?.label ?? code);
      supportedCodes.push(code);
    }
    issuersByCode.get(code)!.add(resolvedIssuer);
    countByCode.set(code, (countByCode.get(code) ?? 0) + 1);
  });

  // Cross-target compatibility: the same code must not resolve to more than one
  // distinct issuer, otherwise payroll would split across incompatible tokens.
  const issuerConflicts: PaymentAssetIssuerConflict[] = [];
  const conflictedCodes = new Set<string>();
  for (const [code, issuers] of issuersByCode.entries()) {
    if (issuers.size > 1) {
      conflictedCodes.add(code);
      issuerConflicts.push({
        code,
        issuers: Array.from(issuers).flatMap((issuer) =>
          issuer === NATIVE_ISSUER ? [] : [issuer],
        ),
        reason: `${code} is assigned with ${issuers.size} different issuer accounts across payment targets. Recipients would be paid in different, incompatible tokens.`,
      });
    }
  }

  const mismatchedCodes = new Set(
    issuerMismatches
      .map((m) => m.assetCode)
      .filter((code): code is string => typeof code === "string"),
  );

  // Compatible assets: supported, not conflicted, and not issuer-mismatched.
  const compatibleAssets: CompatiblePaymentAsset[] = supportedCodes
    .filter((code) => !conflictedCodes.has(code) && !mismatchedCodes.has(code))
    .map((code) => {
      const issuer = Array.from(issuersByCode.get(code)!).find(
        (value): value is string => value !== NATIVE_ISSUER,
      );
      return {
        code,
        label: labelsByCode.get(code) ?? code,
        issuer,
        paymentCount: countByCode.get(code) ?? 0,
      };
    });

  // Blockers come from issuer conflicts and canonical mismatches.
  const blockers: string[] = [
    ...issuerConflicts.map((c) => c.reason),
    ...issuerMismatches.map((m) => m.reason),
  ];
  const hasBlockingIssuerIssue = blockers.length > 0;

  // Advisory warnings for ignored/ skipped targets.
  if (unsupportedAssets.length > 0) {
    warnings.push(`Unsupported assets ignored: ${unsupportedAssets.join(", ")}.`);
  }
  if (invalidTargets.length > 0) {
    warnings.push(
      `${invalidTargets.length} malformed payment target${invalidTargets.length === 1 ? "" : "s"} skipped.`,
    );
  }

  const noCompatibleAssets = compatibleAssets.length === 0;
  if (noCompatibleAssets && !hasBlockingIssuerIssue) {
    blockers.push(
      `No compatible payment assets remain. Assign each employee a supported asset (${supportedList}) before running payroll.`,
    );
  }

  const status: PaymentAssetCompatibilityStatus =
    hasBlockingIssuerIssue || noCompatibleAssets
      ? "incompatible"
      : warnings.length > 0
        ? "warning"
        : "compatible";
  const canRunPayroll = status !== "incompatible";

  const compatibleCodesList = compatibleAssets.map((a) => a.code).join(", ");
  const totalTargets = paymentTargets.length;

  let summaryMessage: string;
  if (status === "compatible") {
    summaryMessage = `All ${totalTargets} payment${totalTargets === 1 ? "" : "s"} use compatible, supported assets (${compatibleCodesList}).`;
  } else if (status === "warning") {
    summaryMessage = `Payment assets are usable (${compatibleCodesList}), but some targets need review.`;
  } else if (hasBlockingIssuerIssue) {
    const issueCount = issuerConflicts.length + issuerMismatches.length;
    summaryMessage = `Payment asset compatibility failed — ${issueCount} issuer issue${issueCount === 1 ? "" : "s"} must be resolved before running payroll.`;
  } else {
    summaryMessage = `No compatible payment assets remain. Assign each employee a supported asset (${supportedList}) before running payroll.`;
  }

  return {
    status,
    canRunPayroll,
    compatibleAssets,
    unsupportedAssets,
    invalidTargets,
    issuerConflicts,
    issuerMismatches,
    summaryMessage,
    blockers,
    warnings,
    remediationAction: status === "compatible" ? undefined : remediationAction,
  };
}

/**
 * Asserts that payment asset compatibility is satisfied for the intended
 * payments. Throws PaymentAssetCompatibilityError when the run is blocked.
 */
export function assertPaymentAssetCompatibility(paymentTargets: unknown): void {
  const result = evaluatePaymentAssetCompatibility(paymentTargets);
  if (!result.canRunPayroll) {
    throw new PaymentAssetCompatibilityError(
      result.blockers[0] ?? result.summaryMessage,
      result,
    );
  }
}

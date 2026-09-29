import {
  SUPPORTED_PAYROLL_ASSETS,
  formatSupportedAssetsList,
  isSupportedAssetCode,
  getSupportedAsset,
} from "./supportedAssets";
import type {
  AssetAvailabilitySafetyResult,
  AssetAvailabilitySafetyStatus,
  AssetValidationError,
  ConfiguredAssetItem,
} from "@/types/assets";

/**
 * Thrown when payroll execution is attempted while asset availability is blocked.
 */
export class AssetAvailabilitySafetyError extends Error {
  public readonly result: AssetAvailabilitySafetyResult;

  constructor(message: string, result: AssetAvailabilitySafetyResult) {
    super(message);
    this.name = "AssetAvailabilitySafetyError";
    this.result = result;
  }
}

/**
 * Stellar public key regex: 56 base32 alphanumeric characters starting with 'G'.
 */
const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Stellar asset code regex: 1 to 12 alphanumeric characters.
 */
const STELLAR_ASSET_CODE_REGEX = /^[A-Za-z0-9]{1,12}$/;

/**
 * Validates a Stellar asset code.
 */
export function validateAssetCode(code: unknown): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (typeof code !== "string" || code.trim().length === 0) {
    return { valid: false, error: "Asset code cannot be empty" };
  }

  const trimmed = code.trim();
  if (!STELLAR_ASSET_CODE_REGEX.test(trimmed)) {
    return {
      valid: false,
      normalized: trimmed.toUpperCase(),
      error: `Asset code "${trimmed}" is invalid. Stellar asset codes must be 1 to 12 alphanumeric characters.`,
    };
  }

  return { valid: true, normalized: trimmed.toUpperCase() };
}

/**
 * Validates a Stellar asset issuer account address.
 */
export function validateAssetIssuer(
  code: string,
  issuer?: unknown,
): { valid: boolean; error?: string } {
  const normalizedCode = code.trim().toUpperCase();

  // XLM is the native asset and has no issuer.
  if (normalizedCode === "XLM") {
    if (issuer !== undefined && issuer !== null && issuer !== "") {
      return {
        valid: false,
        error: "Native XLM must not specify an issuer account.",
      };
    }
    return { valid: true };
  }

  // If issuer is provided, validate format.
  if (issuer !== undefined && issuer !== null && typeof issuer === "string" && issuer.trim() !== "") {
    const trimmedIssuer = issuer.trim();
    if (!STELLAR_PUBLIC_KEY_REGEX.test(trimmedIssuer)) {
      return {
        valid: false,
        error: `Issuer address "${trimmedIssuer}" for asset ${normalizedCode} is not a valid 56-character Stellar public key starting with G.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Pure evaluation function that assesses configured payroll assets against safety rules.
 *
 * Privacy-safe: Operates strictly on asset symbols and issuers. Never inspects
 * employee counts, disbursement amounts, or wallet balances.
 */
export function evaluateAssetAvailabilitySafety(
  configuredAssets: unknown,
): AssetAvailabilitySafetyResult {
  const defaultRemediation = {
    label: "Configure payroll assets",
    href: "/settings/assets",
  };

  // Blocked if input is null, undefined, not an array, or empty array
  if (!Array.isArray(configuredAssets) || configuredAssets.length === 0) {
    const supportedList = formatSupportedAssetsList();
    return {
      status: "blocked",
      canExecutePayroll: false,
      supportedAssets: [],
      unsupportedAssets: [],
      invalidAssets: [],
      duplicateAssets: [],
      summaryMessage: `Payroll creation is blocked until a supported asset (${supportedList}) is configured.`,
      blockers: [
        `No payroll assets are configured. Payroll creation is blocked until a supported asset (${supportedList}) is configured.`,
      ],
      warnings: [],
      remediationAction: defaultRemediation,
    };
  }

  const seenCodes = new Set<string>();
  const duplicateAssets: string[] = [];
  const invalidAssets: AssetValidationError[] = [];
  const supportedAssets: Array<{ code: string; label: string; issuer?: string }> = [];
  const unsupportedAssets: string[] = [];
  const warnings: string[] = [];

  for (const item of configuredAssets) {
    if (!item || typeof item !== "object") {
      invalidAssets.push({
        reason: "Asset item must be an object with a code property.",
      });
      continue;
    }

    const rawCode = (item as ConfiguredAssetItem).code;
    const codeValidation = validateAssetCode(rawCode);

    if (!codeValidation.valid || !codeValidation.normalized) {
      invalidAssets.push({
        assetCode: typeof rawCode === "string" ? rawCode : undefined,
        reason: codeValidation.error ?? "Invalid asset code",
      });
      continue;
    }

    const normalizedCode = codeValidation.normalized;
    const issuer = (item as ConfiguredAssetItem).issuer;
    const issuerValidation = validateAssetIssuer(normalizedCode, issuer);

    if (!issuerValidation.valid) {
      invalidAssets.push({
        assetCode: normalizedCode,
        reason: issuerValidation.error ?? "Invalid asset issuer",
      });
      continue;
    }

    // Duplicate detection
    if (seenCodes.has(normalizedCode)) {
      if (!duplicateAssets.includes(normalizedCode)) {
        duplicateAssets.push(normalizedCode);
      }
      continue;
    }
    seenCodes.add(normalizedCode);

    // Allowlist check
    if (isSupportedAssetCode(normalizedCode)) {
      const canonicalAsset = getSupportedAsset(normalizedCode);
      supportedAssets.push({
        code: normalizedCode,
        label: canonicalAsset?.label ?? normalizedCode,
        issuer: canonicalAsset?.issuer ?? (typeof issuer === "string" ? issuer : undefined),
      });
    } else {
      unsupportedAssets.push(normalizedCode);
    }
  }

  const supportedList = formatSupportedAssetsList();

  // If no valid supported assets are found, block payroll execution
  if (supportedAssets.length === 0) {
    const blockers: string[] = [
      `Payroll creation is blocked until a supported asset (${supportedList}) is configured.`,
    ];

    if (unsupportedAssets.length > 0) {
      warnings.push(`Unsupported assets ignored: ${unsupportedAssets.join(", ")}.`);
    }

    if (invalidAssets.length > 0) {
      warnings.push(
        `${invalidAssets.length} invalid asset configuration(s) detected and rejected.`,
      );
    }

    return {
      status: "blocked",
      canExecutePayroll: false,
      supportedAssets: [],
      unsupportedAssets,
      invalidAssets,
      duplicateAssets,
      summaryMessage: `Payroll creation is blocked until a supported asset (${supportedList}) is configured.`,
      blockers,
      warnings,
      remediationAction: defaultRemediation,
    };
  }

  // Supported assets exist: check for any advisory warnings
  const hasWarnings =
    unsupportedAssets.length > 0 ||
    invalidAssets.length > 0 ||
    duplicateAssets.length > 0;

  if (unsupportedAssets.length > 0) {
    warnings.push(`Unsupported assets ignored: ${unsupportedAssets.join(", ")}.`);
  }

  if (invalidAssets.length > 0) {
    warnings.push(
      `${invalidAssets.length} malformed asset configuration(s) skipped.`,
    );
  }

  if (duplicateAssets.length > 0) {
    warnings.push(
      `Duplicate asset configuration detected for: ${duplicateAssets.join(", ")}.`,
    );
  }

  const supportedCodesList = supportedAssets.map((a) => a.code).join(", ");
  const status: AssetAvailabilitySafetyStatus = hasWarnings ? "warning" : "available";
  const summaryMessage = hasWarnings
    ? `Supported payroll assets are configured (${supportedCodesList}), but some assets require review.`
    : `Supported payroll assets are configured (${supportedCodesList}).`;

  return {
    status,
    canExecutePayroll: true,
    supportedAssets,
    unsupportedAssets,
    invalidAssets,
    duplicateAssets,
    summaryMessage,
    blockers: [],
    warnings,
    remediationAction: hasWarnings ? defaultRemediation : undefined,
  };
}

/**
 * Asserts that asset availability is verified and safe for payroll processing.
 * Throws AssetAvailabilitySafetyError if blocked.
 */
export function assertAssetAvailabilitySafety(configuredAssets: unknown): void {
  const result = evaluateAssetAvailabilitySafety(configuredAssets);
  if (!result.canExecutePayroll || result.status === "blocked") {
    throw new AssetAvailabilitySafetyError(
      result.blockers[0] ?? result.summaryMessage,
      result,
    );
  }
}

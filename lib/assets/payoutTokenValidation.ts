/**
 * Payout token validation for settlement review.
 *
 * Checks a payout token symbol against the supported payroll allowlist
 * (lib/assets/supportedAssets.ts) and returns a named error code with an
 * actionable message when the token cannot be settled.
 *
 * Privacy-safe: messages mention only the asset code and the supported list.
 * They never include amounts, employee identities, wallet addresses or counts.
 */

import { formatSupportedAssetsList, isSupportedAssetCode } from "./supportedAssets";

export const PAYOUT_TOKEN_ERROR_CODES = {
  MISSING: "PAYOUT_TOKEN_MISSING",
  UNSUPPORTED: "UNSUPPORTED_PAYOUT_TOKEN",
} as const;

export type PayoutTokenErrorCode =
  (typeof PAYOUT_TOKEN_ERROR_CODES)[keyof typeof PAYOUT_TOKEN_ERROR_CODES];

export type PayoutTokenValidationResult =
  | { valid: true; code: string; errorCode: null; message: null }
  | {
      valid: false;
      code: string | null;
      errorCode: PayoutTokenErrorCode;
      message: string;
    };

export type PayoutTokenValidationFailure = Extract<
  PayoutTokenValidationResult,
  { valid: false }
>;

/** Only short, plain asset-code-shaped symbols are echoed back in messages. */
const ECHOABLE_CODE_PATTERN = /^[A-Z0-9]{1,12}$/;

/** Normalizes a token symbol the same way the supported-asset lookup does. */
export function normalizePayoutTokenCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

export function validatePayoutToken(raw: unknown): PayoutTokenValidationResult {
  const supportedList = formatSupportedAssetsList();
  const code = normalizePayoutTokenCode(raw);

  if (!code) {
    return {
      valid: false,
      code: null,
      errorCode: PAYOUT_TOKEN_ERROR_CODES.MISSING,
      message: `Payout token is missing. Choose a supported token (${supportedList}) for this settlement group, then review again.`,
    };
  }

  if (!isSupportedAssetCode(code)) {
    const echoed = ECHOABLE_CODE_PATTERN.test(code) ? code : null;
    const subject = echoed ? `"${echoed}"` : "This token";
    return {
      valid: false,
      code: echoed,
      errorCode: PAYOUT_TOKEN_ERROR_CODES.UNSUPPORTED,
      message: `${subject} is not a supported payout token for settlement. Switch this group to a supported token (${supportedList}), then review again.`,
    };
  }

  return { valid: true, code, errorCode: null, message: null };
}

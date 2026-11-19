/** Settlement receipt replay identifiers are opaque, lowercase identifiers for tracking receipt replay events. */
const SETTLEMENT_RECEIPT_REPLAY_ID_PATTERN = /^rcpt_replay_[a-z0-9][a-z0-9_-]{2,127}$/;

export const SETTLEMENT_RECEIPT_REPLAY_FORMAT_HINT =
  "Expected format: rcpt_replay_<identifier> (lowercase letters, numbers, _ or -).";

export interface SettlementReceiptReplayValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
}

export function normalizeSettlementReceiptReplayId(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validateSettlementReceiptReplayId(raw: string | null | undefined): SettlementReceiptReplayValidationResult {
  const normalized = normalizeSettlementReceiptReplayId(raw);
  if (!normalized) {
    return { isValid: false, normalized, message: "Settlement receipt replay ID is missing." };
  }
  if (!SETTLEMENT_RECEIPT_REPLAY_ID_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Invalid settlement receipt replay ID. ${SETTLEMENT_RECEIPT_REPLAY_FORMAT_HINT}`,
    };
  }
  return { isValid: true, normalized, message: null };
}

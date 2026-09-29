/** Settlement receipt IDs are opaque, lowercase identifiers emitted by the settlement service. */
const SETTLEMENT_RECEIPT_ID_PATTERN = /^rcpt_[a-z0-9][a-z0-9_-]{2,127}$/;

export const SETTLEMENT_RECEIPT_FORMAT_HINT =
  "Expected format: rcpt_<identifier> (lowercase letters, numbers, _ or -).";

export interface SettlementReceiptValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
}

export function normalizeSettlementReceiptId(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validateSettlementReceiptId(raw: string | null | undefined): SettlementReceiptValidationResult {
  const normalized = normalizeSettlementReceiptId(raw);
  if (!normalized) {
    return { isValid: false, normalized, message: "Settlement receipt ID is missing." };
  }
  if (!SETTLEMENT_RECEIPT_ID_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Invalid settlement receipt ID. ${SETTLEMENT_RECEIPT_FORMAT_HINT}`,
    };
  }
  return { isValid: true, normalized, message: null };
}

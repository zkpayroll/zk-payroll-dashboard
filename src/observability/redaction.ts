import type { PayrollEvent, PayrollEventPayload } from "./types";

/**
 * Explicit list of sensitive key patterns (case-insensitive substring/exact matches)
 * that must NEVER appear in plaintext in event payloads or logs.
 */
export const SENSITIVE_KEY_PATTERNS = [
  "salary",
  "amount",
  "totalamount",
  "pay",
  "salarycommitment",
  "expectedamount",
  "confirmedamount",
  "shortfall",
  "requiredamount",
  "availablebalance",
  "totalsalary",
  "employeeid",
  "employeename",
  "ssn",
  "email",
  "name",
  "address",
  "recipientaddress",
  "recipientname",
  "privateinput",
  "privateinputs",
  "secret",
  "blindingfactor",
  "salt",
  "proofinput",
  "witness",
  "proverkey",
  "privatekey",
  "secretkey",
  "seed",
  "seedphrase",
  "mnemonic",
  "passphrase",
  "walletsecret",
  "keypair",
];

/**
 * Strict allowlist of known non-sensitive metadata keys that are allowed in event payloads.
 * Unclassified fields NOT present in this allowlist will be redacted by default (fail-safe).
 */
export const ALLOWED_METADATA_KEYS = new Set([
  "durationMs",
  "errorCategory",
  "errorCode",
  "errorLabel",
  "errorMessage",
  "retryCount",
  "maxRetries",
  "network",
  "assetCode",
  "assetIssuer",
  "transactionHash",
  "txHash",
  "employeeCount",
  "groupCount",
  "proofType",
  "isFunded",
  "employeeRefHash",
  "stage",
  "status",
  "sequence",
  "correlationId",
  // Employer onboarding — safe non-private company identifiers
  "employerId",
  "employerName",
  "companyId",
  "companyName",
  "step",
  "stepLabel",
]);

const DEFAULT_SALT = "zk_payroll_obs_salt_v1_2026";

/**
 * Pure, deterministic string hashing function (SHA-256 approximation / FNV1a-32 expanded)
 * for generating stable, non-reversible employee reference hashes.
 */
export function hashEmployeeId(employeeId: string, salt: string = DEFAULT_SALT): string {
  if (!employeeId) return "emp_ref_none";
  const str = `${salt}:${employeeId}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 310031007);
  }

  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `emp_ref_${part1}${part2}`;
}

/**
 * Check if a key name matches any known sensitive field pattern.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Sanitize error message text to strip potential inline sensitive values
 * like salary amounts, currency values, or emails.
 */
export function sanitizeErrorMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\$\d{1,3}(,\d{3})*(\.\d+)?/g, "[REDACTED_AMOUNT]")
    .replace(/\b\d+(\.\d{1,7})?\s*(XLM|USDC|USD|EUR|BTC|ETH)\b/gi, "[REDACTED_AMOUNT]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
}

/**
 * Redact a raw payload object with fail-safe defaults:
 * 1. If key is in sensitive patterns -> '[REDACTED]'
 * 2. If key is NOT in allowlist -> '[REDACTED_UNCLASSIFIED]'
 * 3. Otherwise -> preserve value
 */
export function redactPayload(payload: Record<string, unknown>): PayrollEventPayload {
  const redacted: PayrollEventPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    // Allowlist takes precedence for explicitly safe employer onboarding keys
    if (ALLOWED_METADATA_KEYS.has(key)) {
      if (key === "errorMessage" && typeof value === "string") {
        redacted[key] = sanitizeErrorMessage(value);
      } else {
        redacted[key] = value;
      }
      continue;
    }

    if (isSensitiveKey(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }

    // Fail-safe: unknown keys are redacted
    redacted[key] = "[REDACTED_UNCLASSIFIED]";
  }

  return redacted;
}

/**
 * Central choke point through which ALL payroll observability events pass.
 * Guarantees that sensitive data is redacted/hashed before emission or storage.
 */
export function redactEvent(event: PayrollEvent): PayrollEvent {
  return {
    ...event,
    payload: redactPayload(event.payload ?? {}),
  };
}

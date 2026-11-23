/**
 * Employee identifier (Stellar wallet address) format helpers (#541).
 *
 * The employee's payout identifier is a Stellar public key ("G…" account ID).
 * These helpers give the form one source of truth for the format hint and for
 * actionable validation messages. Messages never echo the entered address, so
 * identifiers don't end up in error text, toasts or logs.
 */

export const STELLAR_ADDRESS_LENGTH = 56;

/** Short format description shown under the wallet address field. */
export const STELLAR_ADDRESS_FORMAT_HINT =
  "Stellar public key: 56 characters, starts with G, using only A–Z and 2–7 (e.g. GABC…WXYZ). Secret keys start with S — never enter one here.";

const BASE32_BODY = /^[A-Z2-7]+$/;

/**
 * Validate a Stellar public key and return an actionable message, or `null`
 * when the format is valid. Checks run from most to least helpful fix.
 */
export function describeStellarAddressIssue(raw: string): string | null {
  const value = raw.trim();
  if (value.length === 0) {
    return "Enter the employee's Stellar wallet address.";
  }
  if (value.startsWith("S")) {
    return "This looks like a secret key (starts with S). Enter the public key that starts with G instead.";
  }
  if (value.length !== STELLAR_ADDRESS_LENGTH) {
    const diff = STELLAR_ADDRESS_LENGTH - value.length;
    return diff > 0
      ? `Must be ${STELLAR_ADDRESS_LENGTH} characters — ${diff} missing. Check the address was copied in full.`
      : `Must be ${STELLAR_ADDRESS_LENGTH} characters — ${-diff} too many. Remove any extra characters or spaces.`;
  }
  if (!value.startsWith("G")) {
    return "Stellar public keys begin with G.";
  }
  if (value !== value.toUpperCase() && BASE32_BODY.test(value.toUpperCase())) {
    return "Stellar addresses are uppercase — convert the lowercase letters.";
  }
  if (!BASE32_BODY.test(value)) {
    return "Only letters A–Z and digits 2–7 are allowed (no 0, 1, 8, 9 or symbols).";
  }
  return null;
}

/**
 * Categorizes Freighter wallet signing failures into the high-priority
 * failure modes called out in issue #181:
 *
 *  - user rejection
 *  - wrong network
 *  - expired / locked session
 *  - malformed transaction data
 *
 * The shared helper exists so the dashboard overlay (`WalletErrorOverlay`),
 * local telemetry (`mapErrorToType`), and any future call sites stay in
 * lock-step on what counts as which failure mode.
 *
 * The category is intentionally information-rich enough for an operator to
 * pick the right recovery steps without us hard-coding recovery text inside
 * the SDK boundary. Recovery steps live in the overlay / docs, not here.
 */

export type SigningFailureCategory =
  | 'rejected'
  | 'wrong-network'
  | 'expired-session'
  | 'malformed-transaction'
  | 'unknown';

export interface SigningFailure {
  category: SigningFailureCategory;
  /** A short human label suitable for log lines and telemetry. */
  label: string;
}

// Patterns observed in Freighter / @stellar/freighter-api errors.
// Order matters: more specific patterns match before generic ones.
const PATTERNS: Array<{
  category: SigningFailureCategory;
  label: string;
  matcher: RegExp;
}> = [
  {
    category: 'rejected',
    label: 'wallet_rejected',
    // Freighter surfaces user rejections with phrases like
    // "User declined to sign", "rejected by user", "cancelled by user".
    // We deliberately do NOT match bare `\bdenied\b` here: phrases like
    // "access denied" or "permission denied" are auth-layer failures,
    // not user-rejection failures, and should fall through to the
    // expired-session pattern below.
    matcher: /\b(reject|rejecte?d|declin(?:e|ed)|cancel(?:led)?|user\s+denied)\b/i,
  },
  {
    category: 'expired-session',
    label: 'session_expired',
    // Includes Freighter lock / timeout / authorization prompts.
    matcher:
      /\b(locked|lock\s*screen|not\s+allowed|allow\s+access|unauthorized|unauthorised|session\s+expired|expired|permission\s+denied|access\s+denied|reauth|re-authorize)\b/i,
  },
  {
    category: 'malformed-transaction',
    label: 'malformed_tx',
    // XDR / envelope decoding failures from Freighter or our own client.
    matcher: /\b(malformed|invalid\s+(?:xdr|transaction|envelope)|xdr\s+(?:invalid|decode|decode\s+error)|envelope\s+(?:invalid|decode|decode\s+error)|decode\s+(?:error|failed)|encoding\s+(?:error|failed))\b/i,
  },
  {
    category: 'wrong-network',
    label: 'wrong_network',
    // Freighter / horizon responses when the wallet passphrase does not
    // match the network the dapp is configured for.
    matcher: /\b(wrong\s+network|network\s+(?:mismatch|does\s+not\s+match)|invalid\s+network\s+passphrase|network\s+passphrase\s+(?:mismatch|invalid))\b/i,
  },
];

/**
 * Inspect a Freighter error message (or any thrown value) and return the
 * matching failure category. Unknown errors fall back to `unknown` so the
 * caller can show a generic recovery path without misleading operators.
 */
export function categorizeSigningError(
  error: unknown
): SigningFailure {
  const raw = extractMessage(error);
  if (!raw) {
    return { category: 'unknown', label: 'unknown' };
  }

  for (const pattern of PATTERNS) {
    if (pattern.matcher.test(raw)) {
      return { category: pattern.category, label: pattern.label };
    }
  }

  return { category: 'unknown', label: 'unknown' };
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; errorMessage?: unknown };
    if (typeof candidate.message === 'string') return candidate.message;
    if (typeof candidate.errorMessage === 'string') return candidate.errorMessage;
  }
  return null;
}

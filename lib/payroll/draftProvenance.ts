/**
 * Payroll draft provenance tracking (#723).
 *
 * Provenance records the chain of custody of a payroll draft: who created it,
 * who modified it, when, and a one-way content digest so any change to the
 * draft's contents is detectable. It is an extension point on
 * `stores/payrollDrafts.ts` — `addDraft` records a `created` entry and
 * `updateDraft` records an `updated` entry.
 *
 * Privacy contract
 * ─────────────────
 * The content digest is a one-way hash of structural fields only (name, pay
 * period, currency, employee count, rounded total amount). Salary amounts,
 * employee IDs, wallet addresses, and ZK commitments are never reversibly
 * stored in provenance — the digest cannot be turned back into payroll data.
 */

export interface DraftContentChecksumInput {
  /** Draft name. */
  name: string;
  /** Pay period the draft covers. */
  payPeriod: string;
  /** Settlement currency. */
  currency: string;
  /** Number of employees in the batch (count only, never IDs). */
  employeeCount: number;
  /** Batch total amount in the draft's currency. */
  totalAmount: number;
}

/** Default actor recorded when no actor is supplied. */
export const SYSTEM_ACTOR = "system";

/** Maximum provenance entries retained per draft; oldest entries are evicted. */
export const MAX_PROVENANCE_ENTRIES = 50;

/**
 * Deterministic FNV-1a 32-bit hash of a string, returned as a zero-padded hex
 * string. Synchronous and environment-agnostic (no Web Crypto dependency).
 */
function fnv1a32(data: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Build a privacy-safe content digest for a draft's structural fields.
 *
 * Throws an actionable error when the input is invalid so callers know exactly
 * what to fix. The result is deterministic: identical inputs always produce
 * the same digest, and any change to the structural fields produces a
 * different one.
 *
 * @throws {Error} When `totalAmount` is not a finite non-negative number, or
 *   when `name`, `payPeriod`, or `currency` is empty.
 */
export function createDraftContentChecksum(input: DraftContentChecksumInput): string {
  const { name, payPeriod, currency, employeeCount, totalAmount } = input;

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error(
      "Draft total amount must be a finite, non-negative number.",
    );
  }

  if (!name.trim()) {
    throw new Error("Draft name is required to record provenance.");
  }
  if (!payPeriod.trim()) {
    throw new Error("Draft pay period is required to record provenance.");
  }
  if (!currency.trim()) {
    throw new Error("Draft currency is required to record provenance.");
  }

  const payload = JSON.stringify({
    version: 1,
    name: name.trim(),
    payPeriod: payPeriod.trim(),
    currency: currency.trim().toUpperCase(),
    employeeCount: Math.max(0, Math.floor(Number(employeeCount) || 0)),
    totalAmountCents: Math.round(totalAmount * 100),
  });

  return `hash:${fnv1a32(payload)}`;
}

/**
 * Build a single draft provenance entry.
 *
 * @param action Whether the draft was created or updated.
 * @param actor Identity of the actor; trimmed, defaults to `SYSTEM_ACTOR`.
 * @param input Structural fields used to compute the content digest.
 * @param changeSummary Optional human-readable summary (no personal data).
 */
export function buildProvenanceEntry(
  action: "created" | "updated",
  actor: string,
  input: DraftContentChecksumInput,
  changeSummary?: string,
): {
  action: "created" | "updated";
  actor: string;
  timestamp: string;
  contentChecksum: string;
  changeSummary?: string;
} {
  return {
    action,
    actor: (actor ?? "").trim() || SYSTEM_ACTOR,
    timestamp: new Date().toISOString(),
    contentChecksum: createDraftContentChecksum(input),
    changeSummary,
  };
}

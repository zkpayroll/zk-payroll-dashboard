/**
 * Dashboard execution reference generation and collision prevention.
 *
 * Execution references identify a single payroll run (e.g. `pay_lp3k2f9x_a1b2c3`)
 * and must stay unique for the lifetime of the dashboard's in-memory run store.
 * A timestamp-only id (`pay_${Date.now()}`) collides whenever two runs are
 * created within the same millisecond — concurrent admin actions, retried
 * requests, or scripted batch creation all trigger this in practice.
 *
 * Privacy-safe: references never encode salary, employee PII, or commitment
 * hashes — only timestamp and random entropy.
 */

const EXECUTION_REFERENCE_PATTERN = /^pay_[0-9a-z]+_[0-9a-z]{6}$/;

/**
 * Generate a new execution reference: a base36 timestamp plus 6 random
 * base36 characters. The random suffix is what prevents collisions between
 * references generated in the same millisecond.
 */
export function generateExecutionReference(): string {
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `pay_${timestampPart}_${randomPart}`;
}

/**
 * Generate an execution reference guaranteed not to collide with
 * `existingReferences`. Retries with fresh entropy on collision; throws if
 * it cannot find a free reference within `maxAttempts` (practically
 * unreachable — each attempt has roughly a 1-in-2^31 chance of collision).
 */
export function generateUniqueExecutionReference(
  existingReferences: Iterable<string>,
  maxAttempts = 10,
): string {
  const seen = new Set(existingReferences);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateExecutionReference();
    if (!seen.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Failed to generate a unique execution reference after multiple attempts.",
  );
}

/**
 * Check whether a given execution reference collides with an existing set
 * of references. Comparison is exact (references are machine-generated and
 * not meant to be hand-typed, unlike import references).
 */
export function isExecutionReferenceCollision(
  reference: string,
  existingReferences: Iterable<string>,
): boolean {
  for (const existing of existingReferences) {
    if (existing === reference) {
      return true;
    }
  }
  return false;
}

/**
 * Validate that a string has the shape of a dashboard-generated execution
 * reference. Does not check uniqueness.
 */
export function isWellFormedExecutionReference(reference: string): boolean {
  return EXECUTION_REFERENCE_PATTERN.test(reference);
}

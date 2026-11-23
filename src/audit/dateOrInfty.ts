/**
 * Internal helper shared between the dashboard audit event sequence verifier
 * and its tests.
 *
 * Parse a timestamp string to milliseconds since epoch. Non-parseable values
 * are treated as `Infinity` so they sort to the end of either direction and
 * still trigger an actionable problem.
 */

export function dateOrInfty(ts: string): number {
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : Infinity;
}

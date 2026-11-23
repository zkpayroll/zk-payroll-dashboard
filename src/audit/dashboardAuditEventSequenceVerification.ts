/** @license Apache-2.0 |

 * Dashboard audit event sequence verification (#668).
 *
 * Verifies that the dashboard's audit activity feed is internally consistent
 * as a sequence: every entry has a parseable timestamp, the displayed order
 * is monotonic in time for the chosen direction, and no two semantically
 * distinct entries share the same timestamp.
 *
 * Privacy guarantees: this module operates only on operational audit metadata
 * (timestamps, actor labels, action types). It never inspects, returns, or
 * rejects based on salary amounts, wallet addresses, or employee personal
 * data.
 *
 * Failure model: the verifier returns structured, actionable results so the
 * dashboard can surface remediation guidance rather than a generic error.
 */

import { dateOrInfty } from "./dateOrInfty";

export type DashboardAuditSequenceStatus = "valid" | "invalid";

export interface DashboardAuditSequenceProblem {
  /** Stable machine-readable code used for UI routing / logging. */
  code: DashboardAuditSequenceErrorCode;
  /** Human-readable, privacy-safe explanation including what to fix. */
  message: string;
  /** 0-based index into the feed's current sorted order, when applicable. */
  index?: number;
  /** Optional explicit recommendation action for operators/integrators. */
  recommendedAction?: string;
}

export type DashboardAuditSequenceErrorCode =
  | "duplicate_timestamp"
  | "out_of_order_timestamp"
  | "empty_feed"
  | "single_entry_ignored"
  | "unparseable_timestamp";

export interface DashboardAuditSequenceVerificationResult {
  status: DashboardAuditSequenceStatus;
  /** Ordered list of problems found, in feed order. Empty when status is "valid". */
  problems: DashboardAuditSequenceProblem[];
  /** Total number of entries considered by the verifier. */
  entryCount: number;
  /** When status is "valid", a stable summary suitable for audit logs / toasts. */
  summary?: string;
}

/**
 * Verify the ordering integrity of a dashboard audit activity feed.
 *
 * Checks that the original entry order is monotonic in the given direction:
 * - ascending: timestamps should be non-decreasing
 * - descending: timestamps should be non-increasing
 * No two semantically distinct entries should share the same timestamp.
 *
 * Privacy guarantees: this module operates only on operational audit metadata
 * (timestamps, actor labels, action types). It never inspects, returns, or
 * rejects based on salary amounts, wallet addresses, or employee personal
 * data.
 *
 * Failure model: the verifier returns structured, actionable results so the
 * dashboard can surface remediation guidance rather than a generic error.
 */
export function verifyDashboardAuditEventSequence(
  entries: AuditActivityEntry[],
  direction: "ascending" | "descending" = "descending",
): DashboardAuditSequenceVerificationResult {
  const isAscending = direction === "ascending";

  if (entries.length === 0) {
    return {
      status: "invalid",
      problems: [
        {
          code: "empty_feed",
          message:
            "The audit activity feed is empty. Activity entries are required before sequence integrity can be verified.",
          recommendedAction:
            "Record audit activity entries (for example, key granted/revoked or request approved/rejected) before re-running verification.",
        },
      ],
      entryCount: 0,
    };
  }

  if (entries.length === 1) {
    return {
      status: "invalid",
      problems: [
        {
          code: "single_entry_ignored",
          message: `The audit activity feed contains 1 entry. Sequence verification requires at least 2 entries to detect ordering or duplicate-timestamp conflicts; a single entry is recorded but not verified against a sequence.`,
          recommendedAction:
            "Add at least one more audit activity entry (or wait for feed activity) before sequence verification can report a valid ordering.",
        },
      ],
      entryCount: 1,
    };
  }

  const problems: DashboardAuditSequenceProblem[] = [];

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];

    const prevTime = dateOrInfty(prev.timestamp);
    const currTime = dateOrInfty(curr.timestamp);

    if (!Number.isFinite(prevTime) || !Number.isFinite(currTime)) {
      problems.push({
        code: "unparseable_timestamp",
        index: i,
        message: `Entry at position ${i} has an unparseable timestamp. Each activity entry must use a valid ISO timestamp so the feed order is deterministic.`,
        recommendedAction:
          "Correct the entry's timestamp to a valid ISO 8601 value and refresh the feed.",
      });
      continue;
    }

    // Check monotonicity in the given direction on the original order
    const compare = isAscending ? prevTime - currTime : currTime - prevTime;
    if (compare > 0) {
      problems.push({
        code: "out_of_order_timestamp",
        index: i,
        message: `Entry at position ${i} is out of sequence: its timestamp (${curr.timestamp}) does not follow the previous entry (${prev.timestamp}) in ${direction} order.`,
        recommendedAction:
          direction === "ascending"
            ? "Ensure later entries have later timestamps, or re-sort the feed before displaying it."
            : "Ensure earlier entries have later timestamps in the descending view, or re-sort the feed before displaying it.",
      });
    }

    if (prevTime === currTime && onlyIdDiffers(prev, curr)) {
      continue;
    }

    if (prevTime === currTime && entryContentDiffers(prev, curr)) {
      problems.push({
        code: "duplicate_timestamp",
        index: i,
        message: `Entry at position ${i} shares the same timestamp as the previous entry (${prev.timestamp}) but has different content. Ambiguous timestamps make sequence order non-deterministic.`,
        recommendedAction:
          "Give the later entry a distinct timestamp (even a few milliseconds later) or establish a secondary sequence number for entries that share a timestamp.",
      });
    }
  }

  if (problems.length === 0) {
    return {
      status: "valid",
      problems: [],
      entryCount: entries.length,
      summary: `Audit activity sequence valid: ${entries.length} entries, ${direction} order consistent, no ambiguous timestamps.`,
    };
  }

  return {
    status: "invalid",
    problems,
    entryCount: entries.length,
  };
}

/** Re-export the feed's own shape so consumers do not import from the UI tree. */
export type { AuditActivityEntry, AuditActionType } from "@/stores/auditActivity";

/**
 * Sort the feed into the verification order.
 *
 * - Ascending: finite timestamps ascending, then unparseable timestamps by id.
 * - Descending: finite timestamps descending, then unparseable timestamps by id.
 *
 * This keeps the verifier deterministic even when some entries have
 * unparseable timestamps, while still surfacing them as actionable problems.
 *
 * Note: The sort order is separate from the verification logic; verification
 * checks the original entry order for monotonicity.
 */
function sortFeed(entries: AuditActivityEntry[], direction: "ascending" | "descending"): AuditActivityEntry[] {
  const isAscending = direction === "ascending";
  const finite = entries.filter((e) => Number.isFinite(dateOrInfty(e.timestamp)));
  const infinite = entries.filter((e) => !Number.isFinite(dateOrInfty(e.timestamp)));

  const sortedFinite = [...finite].sort((a, b) => {
    const at = dateOrInfty(a.timestamp);
    const bt = dateOrInfty(b.timestamp);
    if (at !== bt) {
      return isAscending ? at - bt : bt - at;
    }
    // Within the same timestamp, tie-break by id so the order is stable.
    return isAscending ? String(a.id).localeCompare(String(b.id)) : String(b.id).localeCompare(String(a.id));
  });

  const sortedInfinite = [...infinite].sort((a, b) =>
    isAscending ? String(a.id).localeCompare(String(b.id)) : String(b.id).localeCompare(String(a.id)),
  );

  return isAscending ? [...sortedFinite, ...sortedInfinite] : [...sortedFinite, ...sortedInfinite];
}

/**
 * Return true when two entries differ only by id and nothing else that matters
 * for sequence ambiguity. Used to avoid flagging duplicate timestamps when two
 * entries are otherwise identical.
 */
function onlyIdDiffers(a: AuditActivityEntry, b: AuditActivityEntry): boolean {
  return (
    a.id !== b.id &&
    a.action === b.action &&
    a.actor === b.actor &&
    a.actorOrg === b.actorOrg &&
    a.targetName === b.targetName &&
    a.targetOrg === b.targetOrg &&
    a.scope === b.scope &&
    a.summary === b.summary
  );
}

/**
 * Return true when two entries differ in any non-id operational field. Used
 * only to decide whether a shared timestamp is ambiguous; no salary, wallet,
 * or personal data is compared here.
 */
function entryContentDiffers(a: AuditActivityEntry, b: AuditActivityEntry): boolean {
  return (
    a.action !== b.action ||
    a.actor !== b.actor ||
    a.actorOrg !== b.actorOrg ||
    a.targetName !== b.targetName ||
    a.targetOrg !== b.targetOrg ||
    a.scope !== b.scope ||
    a.summary !== b.summary
  );
}

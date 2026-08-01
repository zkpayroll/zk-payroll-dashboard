/**
 * Vendored copy of `@zk-payroll/core`'s
 * `reconciliation/ReconciliationDiffGenerator.ts` — see
 * `lib/reconciliation/format.ts` for the rationale. Once the SDK packaging
 * is fixed, this file can be removed and the dashboard can import the
 * real helper from `@zk-payroll/core`.
 */
import type {
  ObservedPaymentState,
  ReconciliationDiffCategory,
  ReconciliationDiffEntry,
  ReconciliationDiffResult,
} from "./types";

const CATEGORIES: ReconciliationDiffCategory[] = [
  "match",
  "missing",
  "failed_mismatch",
  "amount_mismatch",
  "still_pending",
  "unexpected",
];

/** Key used to match an expected outcome to an observed state. */
function matchKey(recipient: string, asset: string): string {
  return `${recipient}:${asset}`;
}

function entry(
  recipient: string,
  category: ReconciliationDiffCategory,
  reason: string,
  expected?: ReconciliationDiffEntry["expected"],
  observed?: ObservedPaymentState,
): ReconciliationDiffEntry {
  return { recipient, category, reason, expected, observed };
}

/**
 * Compare one expected outcome against its (possibly absent) observed
 * counterpart and classify the result.
 */
function diffOne(
  outcome: {
    recipient: string;
    amount: bigint;
    asset: string;
    status: "success" | "failure" | "pending";
    txHash?: string;
  },
  observed: ObservedPaymentState | undefined,
): ReconciliationDiffEntry {
  const expected = {
    amount: outcome.amount,
    asset: outcome.asset,
    status: outcome.status,
    txHash: outcome.txHash,
  };

  if (outcome.status === "pending") {
    return entry(
      outcome.recipient,
      "still_pending",
      "Expected outcome has not reached a terminal state yet; nothing to reconcile.",
      expected,
      observed,
    );
  }

  if (!observed || observed.onChainStatus === "not_found") {
    return entry(
      outcome.recipient,
      "missing",
      outcome.status === "success"
        ? "Client recorded this payment as successful, but no matching on-chain record was found."
        : "Client recorded this payment as failed, and no on-chain record was found (consistent, but unverifiable).",
      expected,
      observed,
    );
  }

  const expectedSucceeded = outcome.status === "success";
  const observedSucceeded = observed.onChainStatus === "confirmed";

  if (expectedSucceeded !== observedSucceeded) {
    return entry(
      outcome.recipient,
      "failed_mismatch",
      expectedSucceeded
        ? "Client recorded this payment as successful, but the chain shows it failed."
        : "Client recorded this payment as failed, but the chain shows it actually confirmed -- possible duplicate submission or a stale client-side result.",
      expected,
      observed,
    );
  }

  if (
    observedSucceeded &&
    observed.amount !== undefined &&
    observed.amount !== outcome.amount
  ) {
    return entry(
      outcome.recipient,
      "amount_mismatch",
      `Expected amount ${outcome.amount.toString()} stroops does not match observed amount ${observed.amount.toString()} stroops.`,
      expected,
      observed,
    );
  }

  return entry(
    outcome.recipient,
    "match",
    "Expected and observed outcomes agree.",
    expected,
    observed,
  );
}

/**
 * Generate a reconciliation diff between a payroll run's expected results
 * and independently observed on-chain/contract state.
 */
export function generateReconciliationDiff(
  expected: {
    results: Array<{
      recipient: string;
      amount: bigint;
      asset: string;
      status: "success" | "failure" | "pending";
      txHash?: string;
    }>;
  },
  observed: ObservedPaymentState[],
): ReconciliationDiffResult {
  const observedByKey = new Map<string, ObservedPaymentState>();
  for (const o of observed) {
    if (o.asset === undefined) continue;
    const key = matchKey(o.recipient, o.asset);
    const existing = observedByKey.get(key);
    if (!existing || o.observedAt > existing.observedAt) {
      observedByKey.set(key, o);
    }
  }

  const matchedObservedKeys = new Set<string>();
  const entries: ReconciliationDiffEntry[] = expected.results.map((outcome) => {
    const key = matchKey(outcome.recipient, outcome.asset);
    const observedMatch = observedByKey.get(key);
    if (observedMatch) matchedObservedKeys.add(key);
    return diffOne(outcome, observedMatch);
  });

  for (const o of observed) {
    const key = o.asset !== undefined ? matchKey(o.recipient, o.asset) : undefined;
    const wasMatched = key !== undefined && matchedObservedKeys.has(key);
    if (wasMatched) continue;
    if (o.onChainStatus === "not_found") continue;

    entries.push(
      entry(
        o.recipient,
        "unexpected",
        "On-chain record found for this recipient with no corresponding expected outcome in this run.",
        undefined,
        o,
      ),
    );
  }

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    ReconciliationDiffCategory,
    number
  >;
  for (const e of entries) counts[e.category]++;

  const isFullyReconciled = entries.every(
    (e) => e.category === "match" || e.category === "still_pending",
  );

  return { entries, counts, isFullyReconciled, generatedAt: Date.now() };
}
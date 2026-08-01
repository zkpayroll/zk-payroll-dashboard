/**
 * Vendored copy of `@zk-payroll/core`'s `reconciliation/types.ts` — see
 * `lib/reconciliation/format.ts` for context on why this is vendored.
 */

export interface ObservedPaymentState {
  /** Stellar address of the payment recipient. */
  recipient: string;
  /** Observed payment amount in stroops, when determinable. */
  amount?: bigint;
  /** Asset identifier (e.g. "native" or a Soroban token contract ID). */
  asset?: string;
  /** Transaction hash this observation is keyed on, when known. */
  txHash?: string;
  /** What the chain/contract actually shows for this payment. */
  onChainStatus: "confirmed" | "failed" | "not_found";
  /** Epoch ms when this observation was made. */
  observedAt: number;
}

export type ReconciliationDiffCategory =
  | "match"
  | "missing"
  | "failed_mismatch"
  | "amount_mismatch"
  | "still_pending"
  | "unexpected";

export interface ReconciliationDiffEntry {
  recipient: string;
  category: ReconciliationDiffCategory;
  expected?: {
    amount: bigint;
    asset: string;
    status: "success" | "failure" | "pending";
    txHash?: string;
  };
  observed?: ObservedPaymentState;
  /** Human-readable explanation of why this entry was classified this way. */
  reason: string;
}

export interface ReconciliationDiffResult {
  entries: ReconciliationDiffEntry[];
  counts: Record<ReconciliationDiffCategory, number>;
  /** True only when every entry is "match" or "still_pending". */
  isFullyReconciled: boolean;
  generatedAt: number;
}
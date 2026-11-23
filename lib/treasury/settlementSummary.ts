export type TreasurySettlementState = "reserved" | "settled" | "released" | "failed";

export interface TreasurySettlementEntry {
  /** Stable attempt identifier; never display this value as employee data. */
  id: string;
  /** Logical payroll run identifier shared by retries. */
  runId?: string;
  amount: number;
  state: TreasurySettlementState;
}

export interface TreasurySettlementSummary {
  reserved: number;
  settled: number;
  released: number;
  failed: number;
  retryCount: number;
}

/**
 * Summarise the current treasury outcome for each logical payroll run.
 * Entries are ordered oldest-to-newest, so a later retry replaces the prior
 * attempt instead of double-counting its reservation or settlement.
 */
export function summarizeTreasurySettlements(
  entries: readonly TreasurySettlementEntry[],
): TreasurySettlementSummary {
  const latestByRun = new Map<string, TreasurySettlementEntry>();
  let retryCount = 0;

  for (const entry of entries) {
    if (!Number.isFinite(entry.amount) || entry.amount < 0 || !entry.id) continue;
    const runId = entry.runId || entry.id;
    if (latestByRun.has(runId)) retryCount += 1;
    latestByRun.set(runId, entry);
  }

  const summary: TreasurySettlementSummary = {
    reserved: 0,
    settled: 0,
    released: 0,
    failed: 0,
    retryCount,
  };

  for (const entry of latestByRun.values()) summary[entry.state] += entry.amount;
  return summary;
}

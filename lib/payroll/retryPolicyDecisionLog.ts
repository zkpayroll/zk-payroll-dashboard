export type RetryReasonCode =
  | "contract_paused"
  | "permission_denied"
  | "invalid_asset"
  | "invalid_batch_reference"
  | "invalid_description"
  | "invalid_adjustment_limit"
  | "role_refresh_failed"
  | "validation_passed";

export interface RetryPolicyDecisionEntry {
  id: string;
  timestamp: string;
  decision: "allowed" | "blocked";
  retryable: boolean;
  reasonCode: RetryReasonCode;
  message: string;
  operatorId: string;
  batchReference?: string;
}

export class RetryPolicyDecisionLog {
  private readonly entries: RetryPolicyDecisionEntry[] = [];

  record(input: Omit<RetryPolicyDecisionEntry, "id" | "timestamp" | "decision">): RetryPolicyDecisionEntry {
    const entry: RetryPolicyDecisionEntry = {
      ...input,
      id: `retry-decision-${this.entries.length + 1}`,
      timestamp: new Date().toISOString(),
      decision: input.retryable ? "allowed" : "blocked",
    };
    this.entries.push(entry);
    return entry;
  }

  list(): RetryPolicyDecisionEntry[] {
    return [...this.entries];
  }
}

export { logRetryPolicyDecision } from "./retryPolicyLogging";

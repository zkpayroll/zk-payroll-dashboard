export type PayrollStage =
  | "draft"
  | "validation"
  | "proof_setup"
  | "wallet_signing"
  | "tx_submission"
  | "polling"
  | "failure"
  | "retry"
  | "reconciliation"
  | "employer_onboarding";

export type PayrollEventStatus = "started" | "succeeded" | "failed" | "retried";

export interface PayrollEventPayload {
  durationMs?: number;
  errorCategory?: string;
  errorCode?: string;
  errorLabel?: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  network?: string;
  assetCode?: string;
  assetIssuer?: string;
  transactionHash?: string;
  txHash?: string;
  employeeCount?: number;
  groupCount?: number;
  proofType?: string;
  isFunded?: boolean;
  employeeRefHash?: string;
  [key: string]: unknown;
}

export interface PayrollEvent {
  id: string;
  correlationId: string;
  sequence: number;
  timestamp: string;
  stage: PayrollStage;
  status: PayrollEventStatus;
  payload: PayrollEventPayload;
}

export interface PayrollEventInput {
  correlationId: string;
  stage: PayrollStage;
  status: PayrollEventStatus;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface IncidentTimelineEntry {
  id: string;
  sequence: number;
  timestamp: string;
  stage: PayrollStage;
  status: PayrollEventStatus;
  durationMs?: number;
  errorCategory?: string;
  errorCode?: string;
  errorLabel?: string;
  errorMessage?: string;
  redactedContext: Record<string, unknown>;
  formattedSummary: string;
}

export interface IncidentTimeline {
  correlationId: string;
  runStatus: "succeeded" | "failed" | "in_progress" | "partial";
  totalDurationMs: number;
  eventCount: number;
  startedAt: string;
  endedAt: string | null;
  hasFailures: boolean;
  entries: IncidentTimelineEntry[];
}

export type TreasuryHealthStatus = "healthy" | "warning" | "critical";

export interface TreasurySnapshotEvent {
  id: string;
  timestamp: string;
  eventType:
    | "snapshot_created"
    | "snapshot_locked"
    | "funding_reserved"
    | "merkle_verified"
    | "reservation_released";
  merkleRoot: string;
  assetCode: string;
  employeeCount: number;
  status: "success" | "warning" | "error";
  description: string;
  warningMessage?: string;
}

export interface TreasuryHealthSnapshot {
  status: TreasuryHealthStatus;
  assetCode: string;
  coveragePercentage: number;
  activeObligationsCount: number;
  lastSnapshotMerkleRoot: string;
  isHealthy: boolean;
  warning: string | null;
  events: TreasurySnapshotEvent[];
  privacyNotice: string;
}

export const TREASURY_PRIVACY_NOTICE =
  "Treasury metrics display aggregate coverage ratios and Merkle roots only. Individual salaries remain private and encrypted.";

export function formatMerkleRootShort(root: string, visible = 10): string {
  if (!root) return "—";
  if (root.length <= visible + 6) return root;
  return `${root.slice(0, visible)}…${root.slice(-6)}`;
}

/**
 * Calculates privacy-safe treasury health metrics and formats activity events.
 * Guarantees zero exposure of raw salary values or employee PII.
 */
export function calculateTreasurySnapshotHealth(
  assetCode: string,
  availableAmount: number,
  requiredAmount: number,
  events: TreasurySnapshotEvent[] = []
): TreasuryHealthSnapshot {
  const safeAvailable = Math.max(0, availableAmount || 0);
  const safeRequired = Math.max(0, requiredAmount || 0);

  let coveragePercentage = 100;
  if (safeRequired > 0) {
    coveragePercentage = Math.round((safeAvailable / safeRequired) * 100);
  }

  let status: TreasuryHealthStatus = "healthy";
  let warning: string | null = null;

  if (coveragePercentage < 80) {
    status = "critical";
    warning = `Critical treasury funding deficit: Coverage is at ${coveragePercentage}%. Replenish ${assetCode} balance before initiating payroll runs.`;
  } else if (coveragePercentage < 100) {
    status = "warning";
    warning = `Treasury coverage warning: Reserves are at ${coveragePercentage}% of current obligations. Additional funding recommended.`;
  }

  // Check if any recent event has error/warning status
  const hasEventError = events.some((e) => e.status === "error");
  if (hasEventError && status === "healthy") {
    status = "warning";
    warning = "Recent treasury snapshot event reported a verification error. Review snapshot logs.";
  }

  const latestEvent = events[0];
  const lastSnapshotMerkleRoot = latestEvent?.merkleRoot || "0x0000000000000000000";

  return {
    status,
    assetCode,
    coveragePercentage,
    activeObligationsCount: events.length,
    lastSnapshotMerkleRoot,
    isHealthy: status === "healthy",
    warning,
    events,
    privacyNotice: TREASURY_PRIVACY_NOTICE,
  };
}

export const MOCK_TREASURY_SNAPSHOT_EVENTS: TreasurySnapshotEvent[] = [
  {
    id: "evt_snap_001",
    timestamp: "2026-09-29T10:00:00Z",
    eventType: "snapshot_locked",
    merkleRoot: "0x8f3a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
    assetCode: "USDC",
    employeeCount: 24,
    status: "success",
    description: "Obligation snapshot v3 locked for Period 2026-09",
  },
  {
    id: "evt_snap_002",
    timestamp: "2026-09-29T09:30:00Z",
    eventType: "funding_reserved",
    merkleRoot: "0x8f3a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
    assetCode: "USDC",
    employeeCount: 24,
    status: "success",
    description: "Treasury reserve locked for active payroll obligation",
  },
  {
    id: "evt_snap_003",
    timestamp: "2026-09-28T16:00:00Z",
    eventType: "merkle_verified",
    merkleRoot: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    assetCode: "USDC",
    employeeCount: 24,
    status: "success",
    description: "Merkle root verified against on-chain state digest",
  },
];

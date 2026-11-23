"use client";

import React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  EyeOff,
  Activity,
  Lock,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  calculateTreasurySnapshotHealth,
  formatMerkleRootShort,
  TreasurySnapshotEvent,
  MOCK_TREASURY_SNAPSHOT_EVENTS,
} from "@/src/treasury/snapshotActivity";

export interface TreasurySnapshotActivityCardProps {
  assetCode?: string;
  availableAmount?: number;
  requiredAmount?: number;
  events?: TreasurySnapshotEvent[];
  className?: string;
}

function StatusBadge({ status }: { status: "healthy" | "warning" | "critical" }) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        Healthy
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        Coverage Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
      <AlertOctagon className="h-3.5 w-3.5 text-red-600" />
      Deficit Critical
    </span>
  );
}

function EventTypeIcon({ eventType }: { eventType: TreasurySnapshotEvent["eventType"] }) {
  switch (eventType) {
    case "snapshot_locked":
      return <Lock className="h-3.5 w-3.5 text-indigo-600" />;
    case "funding_reserved":
      return <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />;
    case "merkle_verified":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-gray-500" />;
  }
}

export function TreasurySnapshotActivityCard({
  assetCode = "USDC",
  availableAmount = 50000,
  requiredAmount = 40000,
  events = MOCK_TREASURY_SNAPSHOT_EVENTS,
  className = "",
}: TreasurySnapshotActivityCardProps) {
  const snapshot = calculateTreasurySnapshotHealth(
    assetCode,
    availableAmount,
    requiredAmount,
    events
  );

  return (
    <div
      data-testid="treasury-snapshot-activity-card"
      className={`rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6 ${className}`}
    >
      {/* Card Header & Health Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Treasury Health & Snapshot Activity
            </h2>
            <StatusBadge status={snapshot.status} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time privacy-safe snapshot events and treasury coverage for {snapshot.assetCode}.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md text-xs">
          <EyeOff className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-600">Privacy Mode Active</span>
        </div>
      </div>

      {/* Actionable Warning Banner (if deficit or warning) */}
      {snapshot.warning && (
        <div
          role="alert"
          data-testid="treasury-health-warning"
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            snapshot.status === "critical"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {snapshot.status === "critical" ? (
            <AlertOctagon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">Treasury Health Action Required</p>
            <p className="mt-0.5 text-xs">{snapshot.warning}</p>
          </div>
        </div>
      )}

      {/* Overview Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
          <span className="text-xs text-gray-500 font-medium">Reserve Coverage Ratio</span>
          <p className={`text-lg font-bold mt-1 ${
            snapshot.coveragePercentage >= 100 ? "text-green-700" : "text-amber-700"
          }`}>
            {snapshot.coveragePercentage}%
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
          <span className="text-xs text-gray-500 font-medium">Active Asset</span>
          <p className="text-lg font-bold text-gray-900 mt-1">{snapshot.assetCode}</p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
          <span className="text-xs text-gray-500 font-medium">Latest Merkle Digest</span>
          <p className="text-xs font-mono font-semibold text-indigo-700 mt-2 truncate">
            {formatMerkleRootShort(snapshot.lastSnapshotMerkleRoot)}
          </p>
        </div>
      </div>

      {/* Snapshot Activity Events Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center justify-between">
          <span>Recent Snapshot Events ({snapshot.events.length})</span>
          <span className="text-[10px] text-gray-400 font-normal">Encrypted Merkle Proofs</span>
        </h3>

        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden bg-white">
          {snapshot.events.map((evt) => (
            <div key={evt.id} className="p-3.5 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
              <div className="mt-0.5 p-1.5 rounded-md bg-gray-100 shrink-0">
                <EventTypeIcon eventType={evt.eventType} />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-900 truncate">
                    {evt.description}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                  <span>Merkle: {formatMerkleRootShort(evt.merkleRoot)}</span>
                  <span>Employees: {evt.employeeCount}</span>
                </div>

                {evt.warningMessage && (
                  <p className="text-xs text-red-600 font-medium">{evt.warningMessage}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Privacy Guarantee */}
      <div className="flex items-center justify-between pt-2 text-[11px] text-gray-400 border-t border-gray-100">
        <span>{snapshot.privacyNotice}</span>
        <span className="font-mono">ZK-PROOF VERIFIED</span>
      </div>
    </div>
  );
}

export default TreasurySnapshotActivityCard;

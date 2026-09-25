"use client";

import { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  Timer,
  Ban,
  Wallet,
  User,
} from "lucide-react";
import { useWalletRotationStore, maskAddress } from "@/stores/walletRotation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  WalletRotationEvent,
  WalletRotationEventType,
  WalletRotationReasonCode,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const EVENT_ICON: Record<WalletRotationEventType, typeof Clock> = {
  rotation_requested: RotateCcw,
  approval_granted: CheckCircle2,
  approval_rejected: XCircle,
  cooldown_activated: Timer,
  cooldown_expired: Clock,
  emergency_override: ShieldAlert,
  rotation_completed: CheckCircle2,
  rotation_failed: Ban,
};

const EVENT_TONE: Record<WalletRotationEventType, "neutral" | "success" | "warning" | "danger"> = {
  rotation_requested: "neutral",
  approval_granted: "success",
  approval_rejected: "danger",
  cooldown_activated: "warning",
  cooldown_expired: "neutral",
  emergency_override: "danger",
  rotation_completed: "success",
  rotation_failed: "danger",
};

const TONE_CLASSES: Record<string, string> = {
  neutral: "text-gray-400",
  success: "text-green-500",
  warning: "text-amber-500",
  danger: "text-red-500",
};

const REASON_LABELS: Record<WalletRotationReasonCode, string> = {
  key_compromise: "Key Compromise",
  device_loss: "Device Loss",
  scheduled_rotation: "Scheduled Rotation",
  compliance_requirement: "Compliance Requirement",
  emergency: "Emergency",
};

// ─── Props ──────────────────────────────────────────────────────────────────

export interface WalletRotationTimelineProps {
  employeeId: string;
  employeeName?: string;
  /** When true, wallet addresses are shown in full instead of masked */
  showFullAddresses?: boolean;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WalletRotationTimeline({
  employeeId,
  employeeName,
  showFullAddresses = false,
  className,
}: WalletRotationTimelineProps) {
  const getRequestForEmployee = useWalletRotationStore((s) => s.getRequestForEmployee);
  const getEventsForEmployee = useWalletRotationStore((s) => s.getEventsForEmployee);
  const getWarningsForEmployee = useWalletRotationStore((s) => s.getWarningsForEmployee);
  const isCooldownActive = useWalletRotationStore((s) => s.isCooldownActive);

  const request = getRequestForEmployee(employeeId);
  const events = getEventsForEmployee(employeeId);
  const warnings = getWarningsForEmployee(employeeId);
  const cooldown = isCooldownActive(employeeId);

  const displayAddress = (addr: string) =>
    showFullAddresses ? addr : maskAddress(addr);

  if (!request) {
    return (
      <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${className ?? ""}`}>
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900">
            Wallet Rotation Timeline
          </h3>
        </div>
        <div className="px-6 py-8 text-center text-sm text-gray-500">
          No wallet rotation history for this employee.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm overflow-hidden ${className ?? ""}`}
      aria-labelledby="wallet-rotation-timeline-heading"
    >
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h3
            id="wallet-rotation-timeline-heading"
            className="text-sm font-medium text-gray-900"
          >
            Wallet Rotation Timeline
          </h3>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* ─── Warnings ────────────────────────────────────────────── */}
        {warnings.length > 0 && (
          <div className="space-y-2" role="alert" aria-label="Wallet rotation warnings">
            {warnings.map((w, i) => (
              <div
                key={`${w.type}-${i}`}
                className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                  w.severity === "critical"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : w.severity === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Request Summary ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Previous Wallet</p>
            <p className="font-mono text-xs text-gray-900 break-all">
              {displayAddress(request.previousWallet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">New Wallet</p>
            <p className="font-mono text-xs text-gray-900 break-all">
              {request.newWallet
                ? displayAddress(request.newWallet)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Reason</p>
            <p className="text-sm font-medium text-gray-900">
              {REASON_LABELS[request.reasonCode]}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Requested By</p>
            <p className="text-sm font-medium text-gray-900">
              {request.requestedBy}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />
              Requested At
            </p>
            <p className="text-sm text-gray-900">
              {new Date(request.requestedAt).toLocaleString()}
            </p>
          </div>
          {request.approvedBy && (
            <div>
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <User className="w-3 h-3" aria-hidden="true" />
                {request.status === "rejected" ? "Rejected By" : "Approved By"}
              </p>
              <p className="text-sm text-gray-900">{request.approvedBy}</p>
            </div>
          )}
          {request.rejectionReason && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{request.rejectionReason}</p>
            </div>
          )}
          {request.isEmergency && (
            <div className="col-span-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                Emergency Rotation
              </span>
            </div>
          )}
        </div>

        {/* ─── Cooldown Status ─────────────────────────────────────── */}
        {cooldown && request.status === "cooldown" && (
          <div
            className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm"
            role="status"
            aria-label="Cooldown active"
          >
            <Timer className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-amber-800">Cooldown Active</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Payroll is blocked until the cooldown period expires. This is a
                safety measure to prevent unauthorized wallet changes.
              </p>
            </div>
          </div>
        )}

        {/* ─── Event Timeline ──────────────────────────────────────── */}
        {events.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Event History</p>
            <ol aria-label="Wallet rotation event timeline" className="space-y-4">
              {[...events]
                .sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime(),
                )
                .map((event) => (
                  <TimelineEventItem
                    key={event.id}
                    event={event}
                    displayAddress={displayAddress}
                  />
                ))}
            </ol>
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <p className="text-xs text-gray-400 pt-2 border-t">
          Sensitive wallet data is masked by default. Full addresses are
          available to authorized auditors.
        </p>
      </div>
    </div>
  );
}

// ─── Timeline Event Item ────────────────────────────────────────────────────

interface TimelineEventItemProps {
  event: WalletRotationEvent;
  displayAddress: (addr: string) => string;
}

function TimelineEventItem({ event, displayAddress }: TimelineEventItemProps) {
  const Icon = EVENT_ICON[event.type];
  const tone = EVENT_TONE[event.type];

  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={`w-4 h-4 mt-0.5 shrink-0 ${TONE_CLASSES[tone]}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-medium text-gray-900">{event.summary}</p>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xxs font-medium text-gray-600">
            {REASON_LABELS[event.reasonCode]}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Actor: {event.actor}
        </p>
        {(event.previousWallet || event.newWallet) && (
          <div className="flex flex-col gap-0.5 mt-1 text-xs text-gray-500 font-mono">
            {event.previousWallet && (
              <span>From: {displayAddress(event.previousWallet)}</span>
            )}
            {event.newWallet && (
              <span>To: {displayAddress(event.newWallet)}</span>
            )}
          </div>
        )}
        <p className="text-xxs text-gray-400 mt-1">
          {new Date(event.timestamp).toLocaleString()}
        </p>
      </div>
    </li>
  );
}

export default WalletRotationTimeline;

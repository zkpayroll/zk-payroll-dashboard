"use client";

import { useState, useMemo } from "react";
import { ShieldAlert, Clock, Unlock, AlertTriangle, X } from "lucide-react";
import {
  useComplianceHoldsStore,
  formatScopeLabel,
  formatReasonLabel,
  type ComplianceHold,
  type ComplianceHoldScope,
} from "@/stores/complianceHolds";

// ─── Hold detail row ────────────────────────────────────────────────────────

function HoldDetailRow({ hold }: { hold: ComplianceHold }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {formatReasonLabel(hold.reasonCode)}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
            {formatScopeLabel(hold.scope)}
          </span>
        </div>
        {hold.targetLabel && (
          <p className="text-xs text-gray-500 mt-0.5">{hold.targetLabel}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(hold.createdAt).toLocaleString()}
          </span>
          {hold.description && <span>{hold.description}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Release confirmation dialog ────────────────────────────────────────────

function ReleaseConfirmation({
  hold,
  onConfirm,
  onCancel,
}: {
  hold: ComplianceHold;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Release compliance hold"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Release Hold?</h3>
        </div>
        <p className="text-sm text-gray-600">
          You are about to release the <strong>{formatReasonLabel(hold.reasonCode)}</strong> compliance hold
          on <strong>{formatScopeLabel(hold.scope)}</strong> scope.
        </p>
        <p className="text-sm text-gray-500">
          {hold.releaseInstruction}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Confirm Release
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ComplianceHoldDetailPanel ──────────────────────────────────────────────

export interface ComplianceHoldDetailPanelProps {
  /** Filter holds by scope */
  scope?: ComplianceHoldScope;
  /** Whether the panel is open */
  isOpen?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Full detail panel for compliance holds.
 * Shows all holds in a detailed list with release flow for authorized users.
 * Sensitive employee details are always redacted.
 */
export default function ComplianceHoldDetailPanel({
  scope,
  isOpen = true,
  onClose,
}: ComplianceHoldDetailPanelProps) {
  const holds = useComplianceHoldsStore((s) => s.holds);
  const currentRole = useComplianceHoldsStore((s) => s.currentRole);
  const releaseHold = useComplianceHoldsStore((s) => s.releaseHold);

  const [releasingHold, setReleasingHold] = useState<ComplianceHold | null>(
    null
  );

  const activeHolds = useMemo(() => {
    const filtered = holds.filter((h) => h.status === "active");
    if (scope) return filtered.filter((h) => h.scope === scope);
    return filtered;
  }, [holds, scope]);

  const canRelease = currentRole === "admin";

  const canReleaseSpecific = (hold: ComplianceHold) => {
    return currentRole !== null && hold.releaseAuthorizedRoles.includes(currentRole);
  };

  if (!isOpen) return null;

  const handleReleaseConfirm = () => {
    if (releasingHold) {
      releaseHold(releasingHold.id, currentRole ?? "unknown");
      setReleasingHold(null);
    }
  };

  return (
    <div
      data-testid="compliance-hold-detail-panel"
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            Active Compliance Holds
          </h3>
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            {activeHolds.length}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {activeHolds.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          No active compliance holds {scope ? `for ${formatScopeLabel(scope)} scope` : ""}
        </div>
      ) : (
        <div>
          {activeHolds.map((hold) => (
            <div key={hold.id} className="relative">
              <HoldDetailRow hold={hold} />
              {canReleaseSpecific(hold) && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => setReleasingHold(hold)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-md border border-green-200 transition-colors"
                  >
                    <Unlock className="w-3 h-3" />
                    Release this hold
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!canRelease && activeHolds.length > 0 && currentRole && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            You do not have permission to release compliance holds.
            Contact an administrator.
          </p>
        </div>
      )}

      {releasingHold && (
        <ReleaseConfirmation
          hold={releasingHold}
          onConfirm={handleReleaseConfirm}
          onCancel={() => setReleasingHold(null)}
        />
      )}
    </div>
  );
}

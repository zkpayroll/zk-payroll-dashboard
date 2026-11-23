"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  AlertCircle,
  UserPlus,
  Timer,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDelegatedApproversStore,
  getTemporaryDelegationStatus,
  type TemporaryDelegation,
  type TemporaryDelegationStatus,
} from "@/stores/delegatedApprovers";

const STATUS_BADGE_STYLES: Record<TemporaryDelegationStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  active: "bg-green-50 text-green-700 border-green-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<TemporaryDelegationStatus, string> = {
  scheduled: "Scheduled",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export interface TemporaryApproverDelegationPanelProps {
  /** Optional custom delegations list; defaults to Zustand store state if omitted. */
  delegations?: TemporaryDelegation[];
  /** Optional callback triggered after successfully scheduling a delegation. */
  onAdd?: (input: {
    address: string;
    label?: string;
    startsAt: string;
    expiresAt: string;
  }) => void;
  /** Optional callback triggered when a delegation is revoked. */
  onRevoke?: (id: string) => void;
  /** Optional clock override, primarily for deterministic tests. */
  now?: number;
  title?: string;
  description?: string;
}

export function formatDelegationWindow(
  startsAt: string,
  expiresAt: string,
): string {
  const start = new Date(startsAt);
  const end = new Date(expiresAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return "Invalid window";
  }
  const days = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  const label = days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : "<1 day";
  return `${start.toLocaleDateString()} – ${end.toLocaleDateString()} (${label})`;
}

export default function TemporaryApproverDelegationPanel({
  delegations: propDelegations,
  onAdd,
  onRevoke,
  now: nowProp,
  title = "Temporary Approver Delegations",
  description = "Grant approvers time-boxed authority over payroll reviews. Delegations activate and lapse automatically — no manual cleanup.",
}: TemporaryApproverDelegationPanelProps) {
  const store = useDelegatedApproversStore();
  const currentDelegations = propDelegations ?? store.temporaryDelegations;

  const [addressInput, setAddressInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [startsAtInput, setStartsAtInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [internalNow, setInternalNow] = useState<number>(() => Date.now());
  const now = nowProp ?? internalNow;

  useEffect(() => {
    if (nowProp !== undefined) return;
    const interval = setInterval(() => setInternalNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [nowProp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startsAtInput || !expiresAtInput) {
      setError(
        "Both start and end times are required. A temporary delegation without a window cannot be scheduled.",
      );
      return;
    }

    if (onAdd) {
      onAdd({
        address: addressInput.trim(),
        label: labelInput.trim() || undefined,
        startsAt: new Date(startsAtInput).toISOString(),
        expiresAt: new Date(expiresAtInput).toISOString(),
      });
    } else {
      const res = store.addTemporaryDelegation({
        address: addressInput,
        label: labelInput,
        startsAt: new Date(startsAtInput).toISOString(),
        expiresAt: new Date(expiresAtInput).toISOString(),
      });
      if (!res.success && res.error) {
        setError(res.error);
        return;
      }
    }

    setAddressInput("");
    setLabelInput("");
    setStartsAtInput("");
    setExpiresAtInput("");
    setError(null);
  };

  const handleRevoke = (id: string) => {
    if (onRevoke) {
      onRevoke(id);
    } else {
      store.revokeTemporaryDelegation(id);
    }
  };

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Timer className="h-5 w-5 text-indigo-600" />
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg text-xs text-indigo-700 font-medium">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          <span>{currentDelegations.length} Delegation(s)</span>
        </div>
      </div>

      {/* Schedule Delegation Form */}
      <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 p-4 rounded-lg border">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-indigo-600" />
          Schedule Temporary Delegation
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label
              htmlFor="temp-delegation-address"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Stellar Address or Delegate Identifier <span className="text-red-500">*</span>
            </label>
            <input
              id="temp-delegation-address"
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. GAYN325M... or delegate-finance-01"
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? "border-red-300 focus:ring-red-500" : "border-gray-300"
              }`}
              aria-invalid={!!error}
              aria-describedby={error ? "temp-delegation-error" : undefined}
            />
          </div>

          <div className="sm:col-span-7">
            <label
              htmlFor="temp-delegation-label"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Role / Description (Optional)
            </label>
            <input
              id="temp-delegation-label"
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. Acting Finance Lead"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="temp-delegation-start"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Starts At <span className="text-red-500">*</span>
            </label>
            <input
              id="temp-delegation-start"
              type="datetime-local"
              value={startsAtInput}
              onChange={(e) => {
                setStartsAtInput(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="temp-delegation-expires"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Expires At <span className="text-red-500">*</span>
            </label>
            <input
              id="temp-delegation-expires"
              type="datetime-local"
              value={expiresAtInput}
              onChange={(e) => {
                setExpiresAtInput(e.target.value);
                if (error) setError(null);
              }}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div
            id="temp-delegation-error"
            role="alert"
            className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Schedule Delegation
          </Button>
        </div>
      </form>

      {/* Delegations List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-700">
          Temporary Delegations ({currentDelegations.length})
        </h3>

        {currentDelegations.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 border border-dashed rounded-lg">
            No temporary delegations scheduled. Time-boxed approver authority will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
            {currentDelegations.map((delegation) => {
              const status = getTemporaryDelegationStatus(delegation, now);
              const canRevoke = status === "scheduled" || status === "active";
              return (
                <li
                  key={delegation.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-gray-900">
                        {delegation.address.length > 16
                          ? `${delegation.address.slice(0, 8)}...${delegation.address.slice(-6)}`
                          : delegation.address}
                      </span>
                      <span
                        data-testid={`delegation-status-${delegation.id}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE_STYLES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    {delegation.label && (
                      <p className="text-gray-500">{delegation.label}</p>
                    )}
                    <p className="text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDelegationWindow(
                        delegation.startsAt,
                        delegation.expiresAt,
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canRevoke ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevoke(delegation.id)}
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                        aria-label={`Revoke delegation for ${delegation.address}`}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 px-2 py-1">
                        No action available
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

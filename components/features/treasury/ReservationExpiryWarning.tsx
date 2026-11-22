"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  getTimeRemaining,
  useReservationsStore,
  type FundingReservation,
  type ReservationStatus,
} from "@/stores/reservations";
import {
  deduplicateInputReservations,
  describeSingleReservationGuidance,
  parseReservationAmountUnits,
  sanitizeReservationIdentifier,
} from "@/lib/treasury/reservationGuidance";

interface ReservationExpiryWarningProps {
  /** Override the reservations from the store (mainly for testing / embedding). */
  reservations?: FundingReservation[];
  /** Optional clock override for deterministic rendering and single-clock coordination. */
  now?: number;
  className?: string;
}

const STATUS_STYLES: Record<
  ReservationStatus,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    desc: string;
    icon: typeof AlertTriangle;
    iconColor: string;
  }
> = {
  healthy: {
    label: "Healthy",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    desc: "text-emerald-700",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
  },
  warning: {
    label: "Expiring soon",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    desc: "text-amber-700",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
  },
  expired: {
    label: "Expired",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    desc: "text-red-700",
    icon: ShieldAlert,
    iconColor: "text-red-600",
  },
};

function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function ReservationExpiryWarning({
  reservations,
  now: nowOverride,
  className = "",
}: ReservationExpiryWarningProps) {
  const storeReservations = useReservationsStore((s) => s.reservations);
  const refreshReservation = useReservationsStore((s) => s.refreshReservation);
  const revalidateReservation = useReservationsStore(
    (s) => s.revalidateReservation,
  );
  const cancelReservation = useReservationsStore((s) => s.cancelReservation);

  const rawItems = reservations ?? storeReservations;
  const { items, corruptEntries } = deduplicateInputReservations(rawItems);

  // Live clock so countdowns and status transitions update only when needed.
  const shouldTick = nowOverride === undefined && items.length > 0;
  const [tickNow, setTickNow] = useState<number>(() => nowOverride ?? Date.now());
  useEffect(() => {
    if (!shouldTick) {
      return;
    }
    setTickNow(Date.now());
    const interval = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [shouldTick]);

  const effectiveNow = nowOverride ?? tickNow;

  if (items.length === 0 && corruptEntries === 0) {
    return (
      <div
        className={`rounded-lg border border-emerald-200 bg-emerald-50 p-4 ${className}`}
        role="status"
      >
        <div className="flex items-center gap-3">
          <CheckCircle2
            className="w-5 h-5 text-emerald-600 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              No funding reservations found
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              There is no active reservation to review. Create a new reservation
              from the payroll workflow before executing a run.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const evaluatedItems = items.map((reservation) => {
    const itemGuidance = describeSingleReservationGuidance(
      reservation,
      effectiveNow,
    );
    const status: ReservationStatus = itemGuidance.hasCorruptData
      ? "expired"
      : itemGuidance.status;
    const remaining = itemGuidance.hasCorruptData
      ? 0
      : getTimeRemaining(reservation, effectiveNow);
    return { reservation, itemGuidance, status, remaining };
  });

  const hasExpired = evaluatedItems.some((entry) => entry.status === "expired");
  const hasLockedExpired = evaluatedItems.some(
    ({ reservation, status, itemGuidance }) =>
      status === "expired" &&
      (!itemGuidance.isRecoverable ||
        (!reservation.canRefresh && !reservation.canRevalidate)),
  );
  const hasWarning =
    !hasExpired &&
    evaluatedItems.some((entry) => entry.status === "warning");

  return (
    <div className={`space-y-4 ${className}`}>
      {corruptEntries > 0 && (
        <div
          role="alert"
          data-testid="corrupt-reservations-alert"
          className="rounded-lg border border-red-300 bg-red-100 p-4"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="w-5 h-5 mt-0.5 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Malformed reservation records detected
              </h3>
              <p className="text-sm mt-1 text-red-700">
                {corruptEntries} malformed reservation{" "}
                {corruptEntries === 1 ? "entry was" : "entries were"} excluded
                and execution fails closed. Refresh treasury state before
                continuing.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasExpired && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-100 p-4"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="w-5 h-5 mt-0.5 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Expired reservations block execution
              </h3>
              <p className="text-sm mt-1 text-red-700">
                Refresh or revalidate the expired funding reservations below
                before executing payroll, or execution will fail at the contract
                layer.
              </p>
              {hasLockedExpired && (
                <p
                  data-testid="locked-expired-guidance"
                  className="text-xs font-medium mt-1.5 text-red-900"
                >
                  One or more expired reservations cannot be refreshed or
                  revalidated directly. Cancel the expired lock to release funds
                  and create a new reservation, or contact a treasury
                  administrator.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {hasWarning && (
        <div
          role="status"
          data-testid="expiring-soon-guidance-banner"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 mt-0.5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Funding reservations approaching expiry
              </h3>
              <p className="text-sm mt-1 text-amber-800">
                Active locks inside the 5-minute warning window remain usable for
                immediate execution, or click Refresh / Revalidate below to extend
                the 15-minute TTL before submission fails.
              </p>
            </div>
          </div>
        </div>
      )}

      {evaluatedItems.length > 0 && (
        <ul className="space-y-3">
          {evaluatedItems.map(
            ({ reservation, itemGuidance, status, remaining }) => {
              const style = STATUS_STYLES[status];
              const StatusIcon = style.icon;
              const safeBatchId = sanitizeReservationIdentifier(
                reservation.batchId,
                "UNSPECIFIED",
              );
              const safeAsset = sanitizeReservationIdentifier(
                reservation.asset,
                "USDC",
              );
              const parsedAmount = parseReservationAmountUnits(
                reservation.amount,
              );
              const safeAmount =
                parsedAmount.ok && parsedAmount.units > BigInt(0)
                  ? sanitizeReservationIdentifier(reservation.amount, "0.00")
                  : "Invalid amount";

              return (
                <li
                  key={reservation.id}
                  className={`rounded-lg border ${style.border} ${style.bg} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon
                      className={`w-5 h-5 mt-0.5 shrink-0 ${style.iconColor}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3
                          className={`text-sm font-semibold ${style.text}`}
                          title={safeBatchId}
                        >
                          Batch {safeBatchId}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border ${style.border} bg-white px-2 py-0.5 text-xs font-medium ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <span className="block text-xs text-gray-500">
                            Asset
                          </span>
                          <span className="font-medium text-gray-900">
                            {safeAsset}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">
                            Amount
                          </span>
                          <span className="font-medium text-gray-900">
                            {safeAmount}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500">
                            Time remaining
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${style.desc}`}
                          >
                            <Clock
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span
                              suppressHydrationWarning
                              data-testid={`countdown-${reservation.id}`}
                            >
                              {formatCountdown(remaining)}
                            </span>
                          </span>
                        </div>
                      </div>

                      <p
                        data-testid={`reservation-item-guidance-${reservation.id}`}
                        className={`mt-2 text-xs ${style.desc}`}
                      >
                        {itemGuidance.nextStep}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => refreshReservation(reservation.id)}
                          disabled={!reservation.canRefresh}
                          className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RefreshCw
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => revalidateReservation(reservation.id)}
                          disabled={!reservation.canRevalidate}
                          className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          Revalidate
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelReservation(reservation.id)}
                          disabled={!reservation.canCancel}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <XCircle
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            },
          )}
        </ul>
      )}
    </div>
  );
}

export default ReservationExpiryWarning;

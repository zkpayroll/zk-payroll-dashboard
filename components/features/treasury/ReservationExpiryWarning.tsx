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
  getReservationStatus,
  getTimeRemaining,
  useReservationsStore,
  type FundingReservation,
  type ReservationStatus,
} from "@/stores/reservations";

interface ReservationExpiryWarningProps {
  /** Override the reservations from the store (mainly for testing / embedding). */
  reservations?: FundingReservation[];
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
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function ReservationExpiryWarning({
  reservations,
  className = "",
}: ReservationExpiryWarningProps) {
  const storeReservations = useReservationsStore((s) => s.reservations);
  const refreshReservation = useReservationsStore((s) => s.refreshReservation);
  const revalidateReservation = useReservationsStore(
    (s) => s.revalidateReservation,
  );
  const cancelReservation = useReservationsStore((s) => s.cancelReservation);

  const items = reservations ?? storeReservations;

  // Live clock so countdowns and status transitions update over time.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) {
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
          <p className="text-sm font-medium text-emerald-800">
            No funding reservations require attention
          </p>
        </div>
      </div>
    );
  }

  const hasExpired = items.some(
    (r) => getReservationStatus(r, now) === "expired",
  );

  return (
    <div className={`space-y-4 ${className}`}>
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
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((reservation) => {
          const status = getReservationStatus(reservation, now);
          const remaining = getTimeRemaining(reservation, now);
          const style = STATUS_STYLES[status];
          const StatusIcon = style.icon;

          return (
            <li
              key={reservation.id}
              role={status === "expired" ? "alert" : "status"}
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
                      title={reservation.batchId}
                    >
                      Batch {reservation.batchId}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border ${style.border} bg-white px-2 py-0.5 text-xs font-medium ${style.text}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <span className="block text-xs text-gray-500">Asset</span>
                      <span className="font-medium text-gray-900">
                        {reservation.asset}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">Amount</span>
                      <span className="font-medium text-gray-900">
                        {reservation.amount}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">
                        Time remaining
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${style.desc}`}
                      >
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span data-testid={`countdown-${reservation.id}`}>
                          {formatCountdown(remaining)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => refreshReservation(reservation.id)}
                      disabled={!reservation.canRefresh}
                      className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => revalidateReservation(reservation.id)}
                      disabled={!reservation.canRevalidate}
                      className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      Revalidate
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelReservation(reservation.id)}
                      disabled={!reservation.canCancel}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ReservationExpiryWarning;

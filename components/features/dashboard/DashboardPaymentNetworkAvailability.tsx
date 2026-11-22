import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import type {
  PaymentNetworkAvailabilitySignal,
  PaymentNetworkAvailabilityStatus,
} from "@/lib/network/paymentNetworkAvailability";

export interface DashboardPaymentNetworkAvailabilityProps {
  signal: PaymentNetworkAvailabilitySignal;
  className?: string;
}

const STATUS_LABEL: Record<PaymentNetworkAvailabilityStatus, string> = {
  available: "Available",
  degraded: "Degraded",
  unavailable: "Unavailable",
};

const STATUS_STYLES: Record<
  PaymentNetworkAvailabilityStatus,
  { container: string; badge: string; text: string }
> = {
  available: {
    container: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-800",
    text: "text-green-800",
  },
  degraded: {
    container: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    text: "text-amber-800",
  },
  unavailable: {
    container: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-800",
    text: "text-red-800",
  },
};

/**
 * Displays a payment network availability signal on the operations dashboard.
 * Presentational only: the signal is computed by
 * evaluatePaymentNetworkAvailability and never includes private payroll values.
 */
export default function DashboardPaymentNetworkAvailability({
  signal,
  className = "",
}: DashboardPaymentNetworkAvailabilityProps) {
  const styles = STATUS_STYLES[
    signal.status in STATUS_STYLES ? signal.status : "unavailable"
  ];
  const Icon =
    signal.status === "available"
      ? CheckCircle2
      : signal.status === "degraded"
        ? ShieldAlert
        : AlertTriangle;
  const iconColor =
    signal.status === "available" ? "text-green-700" : signal.status === "degraded" ? "text-amber-700" : "text-red-700";

  return (
    <section
      role="status"
      aria-labelledby="dashboard-payment-network-heading"
      className={`rounded-lg border p-4 transition-all ${styles.container} ${className}`}
      data-testid="dashboard-payment-network-availability"
      data-status={signal.status}
      data-stale={signal.isStale ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="dashboard-payment-network-heading"
              className="text-sm font-semibold text-gray-900"
            >
              Payment network
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
            >
              {STATUS_LABEL[signal.status]}
            </span>
          </div>
          <p className={`mt-1 text-sm ${styles.text}`}>{signal.message}</p>
          <p className="mt-1 text-xs text-gray-700">{signal.action}</p>
        </div>
      </div>
    </section>
  );
}

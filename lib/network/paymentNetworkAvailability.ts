/**
 * Payment network availability signals for the operations dashboard.
 *
 * Pure functions only: no I/O, no store access, no logging. A caller runs its
 * own network probe and passes the result here. The raw probe error text is
 * deliberately not part of the probe shape, so RPC endpoints, credentials or
 * payroll values can never leak into a signal or its messages.
 */

export type PaymentNetworkAvailabilityStatus =
  | "available"
  | "degraded"
  | "unavailable";

export interface PaymentNetworkProbeResult {
  /** True when the network answered the health probe successfully. */
  ok: boolean;
  /** Epoch milliseconds when the probe ran. */
  checkedAt: number;
  /** Round-trip latency of the probe in milliseconds, when measured. */
  latencyMs?: number;
}

export interface PaymentNetworkAvailabilitySignal {
  status: PaymentNetworkAvailabilityStatus;
  /** Short, user-facing description of the current state. */
  message: string;
  /** What the operator should do next. Never contains payroll values. */
  action: string;
  /** Epoch milliseconds of the probe, or null when no probe is available. */
  checkedAt: number | null;
  /** True when the probe is missing, too old, or dated in the future. */
  isStale: boolean;
}

export interface PaymentNetworkAvailabilityOptions {
  /** Current time in epoch milliseconds. Defaults to Date.now(). */
  now?: number;
  /** Probes older than this are treated as stale. Defaults to 5 minutes. */
  staleAfterMs?: number;
  /** Successful probes slower than this are reported as degraded. Defaults to 3 seconds. */
  degradedLatencyMs?: number;
}

export const DEFAULT_PAYMENT_NETWORK_STALE_AFTER_MS = 5 * 60_000;
export const DEFAULT_PAYMENT_NETWORK_DEGRADED_LATENCY_MS = 3_000;

const MINUTE_MS = 60_000;

function formatAge(ageMs: number): string {
  const minutes = Math.max(1, Math.round(ageMs / MINUTE_MS));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * Converts a payment network probe result into a dashboard availability signal.
 *
 * Precedence:
 * 1. No probe, or a probe timestamp that is not a finite number: unavailable
 *    (state is unknown, so it is never reported as available).
 * 2. Probe older than `staleAfterMs`, or dated in the future: degraded and stale.
 * 3. Probe failed: unavailable.
 * 4. Probe succeeded but slower than `degradedLatencyMs`: degraded.
 * 5. Otherwise: available.
 */
export function evaluatePaymentNetworkAvailability(
  probe: PaymentNetworkProbeResult | null | undefined,
  options: PaymentNetworkAvailabilityOptions = {},
): PaymentNetworkAvailabilitySignal {
  const now = options.now ?? Date.now();
  const staleAfterMs =
    options.staleAfterMs ?? DEFAULT_PAYMENT_NETWORK_STALE_AFTER_MS;
  const degradedLatencyMs =
    options.degradedLatencyMs ?? DEFAULT_PAYMENT_NETWORK_DEGRADED_LATENCY_MS;

  if (!probe || !Number.isFinite(probe.checkedAt)) {
    return {
      status: "unavailable",
      message: "Payment network status has not been checked yet.",
      action: "Run a network check before submitting payroll.",
      checkedAt: null,
      isStale: true,
    };
  }

  const ageMs = now - probe.checkedAt;
  if (ageMs < 0 || ageMs > staleAfterMs) {
    const ageText =
      ageMs < 0
        ? "The last network check is dated in the future."
        : `The last network check was ${formatAge(ageMs)} ago.`;
    return {
      status: "degraded",
      message: `${ageText} Current network status is unknown.`,
      action: "Refresh the network check before submitting payroll.",
      checkedAt: probe.checkedAt,
      isStale: true,
    };
  }

  if (!probe.ok) {
    return {
      status: "unavailable",
      message:
        "The payment network did not respond to the last check. Payroll submissions may fail.",
      action:
        "Wait for the network to recover, then run the check again. Do not resubmit a payout until its ledger status is confirmed.",
      checkedAt: probe.checkedAt,
      isStale: false,
    };
  }

  if (
    typeof probe.latencyMs === "number" &&
    Number.isFinite(probe.latencyMs) &&
    probe.latencyMs > degradedLatencyMs
  ) {
    return {
      status: "degraded",
      message:
        "The payment network is responding slowly. Confirmations may take longer than usual.",
      action:
        "Allow extra time for confirmations, and avoid starting large payout batches until the network responds normally.",
      checkedAt: probe.checkedAt,
      isStale: false,
    };
  }

  return {
    status: "available",
    message: "The payment network is responding normally.",
    action: "No action needed.",
    checkedAt: probe.checkedAt,
    isStale: false,
  };
}

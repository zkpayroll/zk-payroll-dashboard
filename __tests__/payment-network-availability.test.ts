import { describe, it, expect } from "vitest";
import {
  evaluatePaymentNetworkAvailability,
  DEFAULT_PAYMENT_NETWORK_STALE_AFTER_MS,
} from "@/lib/network/paymentNetworkAvailability";

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);

describe("evaluatePaymentNetworkAvailability", () => {
  it("reports available for a fresh successful probe with normal latency", () => {
    const signal = evaluatePaymentNetworkAvailability(
      { ok: true, checkedAt: NOW - 10_000, latencyMs: 400 },
      { now: NOW },
    );

    expect(signal.status).toBe("available");
    expect(signal.isStale).toBe(false);
    expect(signal.checkedAt).toBe(NOW - 10_000);
    expect(signal.message).toContain("responding normally");
    expect(signal.action).toBe("No action needed.");
  });

  it("reports unavailable with an actionable message when the probe fails", () => {
    const signal = evaluatePaymentNetworkAvailability(
      { ok: false, checkedAt: NOW - 5_000 },
      { now: NOW },
    );

    expect(signal.status).toBe("unavailable");
    expect(signal.isStale).toBe(false);
    expect(signal.message).toMatch(/did not respond/);
    expect(signal.action).toMatch(/Do not resubmit a payout/);
  });

  it("treats a stale successful probe as degraded instead of available", () => {
    const signal = evaluatePaymentNetworkAvailability(
      {
        ok: true,
        checkedAt: NOW - DEFAULT_PAYMENT_NETWORK_STALE_AFTER_MS - 60_000,
        latencyMs: 100,
      },
      { now: NOW },
    );

    expect(signal.status).toBe("degraded");
    expect(signal.isStale).toBe(true);
    expect(signal.message).toContain("6 minutes ago");
    expect(signal.action).toBe(
      "Refresh the network check before submitting payroll.",
    );
  });

  it("reports unavailable when no probe has run yet", () => {
    const signal = evaluatePaymentNetworkAvailability(null, { now: NOW });

    expect(signal.status).toBe("unavailable");
    expect(signal.checkedAt).toBeNull();
    expect(signal.isStale).toBe(true);
  });

  it("reports degraded for a successful but slow probe", () => {
    const signal = evaluatePaymentNetworkAvailability(
      { ok: true, checkedAt: NOW, latencyMs: 4_500 },
      { now: NOW },
    );

    expect(signal.status).toBe("degraded");
    expect(signal.isStale).toBe(false);
  });

  it("treats a probe dated in the future as stale", () => {
    const signal = evaluatePaymentNetworkAvailability(
      { ok: true, checkedAt: NOW + 60_000 },
      { now: NOW },
    );

    expect(signal.status).toBe("degraded");
    expect(signal.isStale).toBe(true);
    expect(signal.message).toContain("dated in the future");
  });
});

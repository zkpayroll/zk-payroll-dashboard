import { describe, it, expect } from "vitest";
import {
  AUDITOR_ACCESS_EXPIRING_WINDOW_MS,
  formatAuditGrantExpiryWarning,
} from "@/lib/date/auditorAccessExpiry";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("Issue #796 — audit grant close-to-expiration warning", () => {
  it("warns when the grant expires within the warning window (success)", () => {
    const expiresAt = new Date(NOW + 2 * DAY_MS).toISOString();
    const w = formatAuditGrantExpiryWarning({ expiresAt }, NOW);
    expect(w).not.toBeNull();
    expect(w!.remainingDays).toBe(2);
    expect(w!.label).toBe("Expires in 2 days");
    expect(w!.message.toLowerCase()).toContain("extend");
  });

  it("returns null for a grant far from expiration (rejection)", () => {
    const expiresAt = new Date(NOW + 30 * DAY_MS).toISOString();
    expect(formatAuditGrantExpiryWarning({ expiresAt }, NOW)).toBeNull();
  });

  it("returns null for a revoked grant (rejection)", () => {
    expect(
      formatAuditGrantExpiryWarning(
        {
          expiresAt: new Date(NOW + 2 * DAY_MS).toISOString(),
          revokedAt: new Date(NOW - DAY_MS).toISOString(),
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("returns null for an already-expired grant (rejection: page-level banner handles those)", () => {
    const expiresAt = new Date(NOW - DAY_MS).toISOString();
    expect(formatAuditGrantExpiryWarning({ expiresAt }, NOW)).toBeNull();
  });

  it("warns at exactly the warning-window boundary (boundary)", () => {
    const expiresAt = new Date(NOW + AUDITOR_ACCESS_EXPIRING_WINDOW_MS).toISOString();
    const w = formatAuditGrantExpiryWarning({ expiresAt }, NOW);
    expect(w).not.toBeNull();
    // Exactly 7 days remaining => "Expires in 7 days"
    expect(w!.remainingDays).toBe(7);
  });

  it("reports at least one remaining day while still inside the window (boundary)", () => {
    const expiresAt = new Date(NOW + 60 * 1000).toISOString();
    const w = formatAuditGrantExpiryWarning({ expiresAt }, NOW);
    expect(w).not.toBeNull();
    // Ceiling: under a day remaining still reads "1 day" so the chip shows
    // instead of visually collapsing into the expired state.
    expect(w!.remainingDays).toBe(1);
    expect(w!.label).toBe("Expires in 1 day");
  });
});

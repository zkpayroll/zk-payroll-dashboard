import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditorAccessExpiryBadge from "@/components/features/compliance/AuditorAccessExpiryBadge";
import {
  evaluateAuditorAccessExpiry,
  AUDITOR_ACCESS_EXPIRING_WINDOW_MS,
} from "@/lib/date/auditorAccessExpiry";
import type { ViewKey } from "@/types";

const NOW = new Date("2026-08-31T12:00:00Z").getTime();

function viewKey(overrides: Partial<ViewKey> = {}): ViewKey {
  return {
    id: overrides.id ?? "vk_test",
    keyId: overrides.keyId ?? "vk_audit_test",
    auditorName: overrides.auditorName ?? "Auditor",
    auditorOrg: overrides.auditorOrg ?? "Compliance Co",
    scope: overrides.scope ?? "read-only",
    grantedBy: overrides.grantedBy ?? "Current Admin",
    createdAt: overrides.createdAt ?? new Date(NOW - 1000).toISOString(),
    expiresAt:
      overrides.expiresAt ??
      new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: overrides.isActive ?? true,
    revokedAt: overrides.revokedAt,
  };
}

describe("evaluateAuditorAccessExpiry", () => {
  it("returns active for grants outside the warning window", () => {
    const result = evaluateAuditorAccessExpiry(viewKey(), NOW);
    expect(result.state).toBe("active");
  });

  it("returns expiring soon inside the warning window", () => {
    const result = evaluateAuditorAccessExpiry(
      viewKey({
        expiresAt: new Date(NOW + 2 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      NOW,
    );
    expect(result.state).toBe("expiring_soon");
  });

  it("returns expired for past or inactive grants", () => {
    expect(
      evaluateAuditorAccessExpiry(
        viewKey({ expiresAt: new Date(NOW - 1000).toISOString() }),
        NOW,
      ).state,
    ).toBe("expired");
    expect(evaluateAuditorAccessExpiry(viewKey({ isActive: false }), NOW).state).toBe(
      "expired",
    );
  });

  it("returns unknown for invalid expiry metadata", () => {
    const result = evaluateAuditorAccessExpiry(
      viewKey({ expiresAt: "not-a-date" }),
      NOW,
    );
    expect(result.state).toBe("unknown");
  });

  it("uses a 7 day default warning window", () => {
    expect(AUDITOR_ACCESS_EXPIRING_WINDOW_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("AuditorAccessExpiryBadge", () => {
  it("renders active, expiring soon, expired, and unknown labels", () => {
    const cases = [
      ["active", viewKey()],
      [
        "expiring_soon",
        viewKey({
          expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
      ["expired", viewKey({ expiresAt: new Date(NOW - 1000).toISOString() })],
      ["unknown", viewKey({ expiresAt: "not-a-date" })],
    ] as const;

    for (const [state, key] of cases) {
      const { unmount } = render(
        <AuditorAccessExpiryBadge viewKey={key} now={NOW} />,
      );
      expect(
        screen.getByTestId(`auditor-access-expiry-${state}`),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("does not expose private payroll values", () => {
    const { container } = render(
      <AuditorAccessExpiryBadge
        viewKey={viewKey({ expiresAt: "not-a-date" })}
        now={NOW}
      />,
    );
    expect(container.textContent).not.toMatch(/\$\d|salary|payroll amount/i);
  });
});


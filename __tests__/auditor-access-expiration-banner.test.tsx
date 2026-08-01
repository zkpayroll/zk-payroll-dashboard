import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditorAccessExpirationBanner, {
  AUDITOR_EXPIRATION_SOON_MS,
} from "@/components/features/compliance/AuditorAccessExpirationBanner";
import type { ViewKey } from "@/types";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function viewKey(overrides: Partial<ViewKey>): ViewKey {
  return {
    id: overrides.id ?? `vk_${Math.random().toString(36).slice(2, 10)}`,
    keyId: overrides.keyId ?? "vk_demo1234abcd",
    auditorName: overrides.auditorName ?? "Sarah Chen",
    auditorOrg: overrides.auditorOrg ?? "Deloitte",
    scope: overrides.scope ?? "full-audit",
    grantedBy: overrides.grantedBy ?? "Current Admin",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    expiresAt:
      overrides.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: overrides.isActive ?? true,
    revokedAt: overrides.revokedAt,
  };
}

interface RenderArgs {
  now?: number;
  warningWindowMs?: number;
  viewKeys?: ViewKey[];
}

function renderBanner({
  now,
  warningWindowMs,
  viewKeys,
}: RenderArgs = {}) {
  const effectiveNow = now ?? Date.now();
  const selector = () => viewKeys ?? [];
  return render(
    <AuditorAccessExpirationBanner
      now={effectiveNow}
      warningWindowMs={warningWindowMs}
      viewKeysSelector={selector}
    />,
  );
}

describe("AuditorAccessExpirationBanner (#199)", () => {
  it("renders nothing when there are no view keys", () => {
    const { container } = renderBanner({ viewKeys: [] });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("renders nothing when all view keys are far from expiring", () => {
    renderBanner({
      viewKeys: [
        viewKey({
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders nothing for revoked/inactive view keys even if past expiresAt", () => {
    renderBanner({
      viewKeys: [
        viewKey({
          isActive: false,
          revokedAt: new Date(Date.now() - 1000).toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      ],
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an error banner when an active key has already expired", () => {
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          expiresAt: new Date(1_700_000_000_000 - 1000).toISOString(),
        }),
      ],
    });
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/expired/i);
    expect(banner).toHaveTextContent("Sarah Chen");
    expect(banner).toHaveTextContent("Deloitte");
  });

  it("renders a warning banner when an active key is within the 7-day window", () => {
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          expiresAt: new Date(1_700_000_000_000 + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/expires in 3 days/i);
  });

  it("aggregates counts when several keys are expiring soon", () => {
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          auditorName: "Alice",
          expiresAt: new Date(1_700_000_000_000 + 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        viewKey({
          auditorName: "Bob",
          expiresAt: new Date(1_700_000_000_000 + 6 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/2 auditor view keys/i);
    // The soonest (sorted ascending) is surfaced by name in the message.
    expect(banner).toHaveTextContent("Alice");
    expect(banner).toHaveTextContent("1 more");
  });

  it("prefers the error variant when at least one key is already expired", () => {
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          auditorName: "Bob",
          expiresAt: new Date(1_700_000_000_000 + 1 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        viewKey({
          auditorName: "Alice",
          expiresAt: new Date(1_700_000_000_000 - 1000).toISOString(),
        }),
      ],
    });
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/expired/i);
  });

  it("honours a custom warning window", () => {
    renderBanner({
      now: 1_700_000_000_000,
      warningWindowMs: 2 * 24 * 60 * 60 * 1000,
      viewKeys: [
        viewKey({
          expiresAt: new Date(1_700_000_000_000 + 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    // Outside the custom 2-day window → should not show anything.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is dismissible when rendered", () => {
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          expiresAt: new Date(1_700_000_000_000 - 1000).toISOString(),
        }),
      ],
    });
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("exposes AUDITOR_EXPIRATION_SOON_MS as 7 days", () => {
    expect(AUDITOR_EXPIRATION_SOON_MS).toBe(SEVEN_DAYS);
  });

  it("ignores keys with invalid expiresAt timestamps", () => {
    // Should not throw, should not render a banner.
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          expiresAt: "not-a-real-date",
        }),
      ],
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismissing the error banner hides it from the page", async () => {
    const user = userEvent.setup();
    renderBanner({
      now: 1_700_000_000_000,
      viewKeys: [
        viewKey({
          expiresAt: new Date(1_700_000_000_000 - 1000).toISOString(),
        }),
      ],
    });
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
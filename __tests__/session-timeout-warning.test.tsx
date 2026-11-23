/**
 * Tests for #471 – Configurable Dashboard Session Timeout Warning
 *
 * Covers:
 *   - useSessionTimeoutWarning hook: level derivation, dismiss, extend, onExpired
 *   - SessionTimeoutWarning component: banner (warning), modal (urgent/expired)
 *
 * Edge cases:
 *   - Re-surfaces warning when level escalates from warning → urgent
 *   - onExpired fires exactly once per expiry cycle
 *   - Extend defaults to session refresh when no onExtend provided
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { SessionTimeoutWarning } from "@/components/features/session/SessionTimeoutWarning";

// ── Mock useSession ──────────────────────────────────────────────────────────

// We control the session state via a mutable object so each test can
// configure it without re-importing modules.
const mockSession = {
  sessionState: "active" as "loading" | "active" | "expiring" | "expired",
  timeRemaining: 30 * 60 * 1000, // 30 min
  formatTimeRemaining: () => "30m remaining",
  refresh: vi.fn(),
};

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockSession,
}));

function setSession(
  state: typeof mockSession["sessionState"],
  timeRemainingMs: number,
  label = "",
) {
  mockSession.sessionState = state;
  mockSession.timeRemaining = timeRemainingMs;
  mockSession.formatTimeRemaining = () =>
    label || `${Math.round(timeRemainingMs / 60000)}m remaining`;
}

// ── Shared hook harness ──────────────────────────────────────────────────────

import { useSessionTimeoutWarning } from "@/hooks/useSessionTimeoutWarning";

const WARNING_MS = 10 * 60 * 1000; // 10 min
const URGENT_MS  =  2 * 60 * 1000; //  2 min

// ── Hook tests ───────────────────────────────────────────────────────────────

describe("useSessionTimeoutWarning hook", () => {
  beforeEach(() => {
    setSession("active", 30 * 60 * 1000);
    mockSession.refresh.mockReset();
  });

  it("returns idle level when session is active with plenty of time", () => {
    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );
    expect(result.current.level).toBe("idle");
    expect(result.current.dismissed).toBe(false);
  });

  it("returns warning level when time is within warning threshold", () => {
    setSession("expiring", 8 * 60 * 1000); // 8 min — inside warning window

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );
    expect(result.current.level).toBe("warning");
  });

  it("returns urgent level when time is within urgent threshold", () => {
    setSession("expiring", 90 * 1000); // 90 sec — inside urgent window

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );
    expect(result.current.level).toBe("urgent");
  });

  it("returns expired level when sessionState is expired", () => {
    setSession("expired", 0, "Expired");

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );
    expect(result.current.level).toBe("expired");
  });

  it("dismiss() sets dismissed=true", () => {
    setSession("expiring", 8 * 60 * 1000);

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );
    act(() => { result.current.dismiss(); });
    expect(result.current.dismissed).toBe(true);
  });

  it("extend() calls onExtend and then sets dismissed=true", async () => {
    setSession("expiring", 8 * 60 * 1000);
    const onExtend = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({
        warningThresholdMs: WARNING_MS,
        urgentThresholdMs: URGENT_MS,
        onExtend,
      }),
    );

    await act(async () => { await result.current.extend(); });

    expect(onExtend).toHaveBeenCalledOnce();
    expect(result.current.dismissed).toBe(true);
  });

  it("extend() falls back to session refresh when no onExtend provided", async () => {
    setSession("expiring", 8 * 60 * 1000);

    const { result } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );

    await act(async () => { await result.current.extend(); });

    expect(mockSession.refresh).toHaveBeenCalledOnce();
  });

  it("onExpired fires exactly once when level becomes expired", () => {
    setSession("expired", 0, "Expired");
    const onExpired = vi.fn();

    renderHook(() =>
      useSessionTimeoutWarning({
        warningThresholdMs: WARNING_MS,
        urgentThresholdMs: URGENT_MS,
        onExpired,
      }),
    );

    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("dismissed resets when level escalates from warning to urgent", () => {
    setSession("expiring", 8 * 60 * 1000);

    const { result, rerender } = renderHook(() =>
      useSessionTimeoutWarning({ warningThresholdMs: WARNING_MS, urgentThresholdMs: URGENT_MS }),
    );

    // Dismiss at warning level
    act(() => { result.current.dismiss(); });
    expect(result.current.dismissed).toBe(true);

    // Escalate to urgent
    act(() => { setSession("expiring", 90 * 1000); });
    rerender();

    // dismissed should reset because the level changed
    expect(result.current.dismissed).toBe(false);
  });
});

// ── Component tests ──────────────────────────────────────────────────────────

describe("SessionTimeoutWarning component", () => {
  beforeEach(() => {
    setSession("active", 30 * 60 * 1000);
    mockSession.refresh.mockReset();
  });

  it("renders nothing when level is idle", () => {
    const { container } = render(<SessionTimeoutWarning />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the sticky banner at warning level", () => {
    setSession("expiring", 8 * 60 * 1000, "8m remaining");

    render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
      />,
    );

    expect(screen.getByTestId("session-timeout-banner")).toBeInTheDocument();
    expect(screen.getByText(/Session expiring/i)).toBeInTheDocument();
    expect(screen.getByText(/8m remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Extend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dismiss/i })).toBeInTheDocument();
  });

  it("hides the banner after Dismiss is clicked", () => {
    setSession("expiring", 8 * 60 * 1000, "8m remaining");

    render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    expect(screen.queryByTestId("session-timeout-banner")).not.toBeInTheDocument();
  });

  it("renders the blocking modal at urgent level", () => {
    setSession("expiring", 90 * 1000, "1m remaining");

    render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
      />,
    );

    expect(screen.getByTestId("session-timeout-modal")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Session expiring soon/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Extend session/i })).toBeInTheDocument();
    // No dismiss button in urgent modal
    expect(screen.queryByRole("button", { name: /Dismiss/i })).not.toBeInTheDocument();
  });

  it("renders the expired modal with sign-in link at expired level", () => {
    setSession("expired", 0, "Expired");

    render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
      />,
    );

    expect(screen.getByTestId("session-timeout-modal")).toBeInTheDocument();
    expect(screen.getByText(/Session expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in again/i })).toBeInTheDocument();
    // No extend button on expired
    expect(screen.queryByRole("button", { name: /Extend session/i })).not.toBeInTheDocument();
  });

  it("calls onExtend when Extend button is clicked", async () => {
    setSession("expiring", 90 * 1000, "1m remaining");
    const onExtend = vi.fn().mockResolvedValue(undefined);

    render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
        onExtend={onExtend}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Extend session/i }));
    });

    await waitFor(() => expect(onExtend).toHaveBeenCalledOnce());
  });

  it("does not expose sensitive payroll data in any rendered text", () => {
    setSession("expiring", 8 * 60 * 1000, "8m remaining");

    const { container } = render(
      <SessionTimeoutWarning
        warningThresholdMs={WARNING_MS}
        urgentThresholdMs={URGENT_MS}
      />,
    );

    const text = container.textContent ?? "";
    // Ensure no wallet addresses or salary-like numbers are present
    expect(text).not.toMatch(/\$\d{4,}/);
    expect(text).not.toMatch(/G[A-Z2-7]{55}/);
  });
});

/**
 * Tests for #469 – Accessible Toast Announcements for Payroll Results
 *
 * Covers:
 *   - useAnnouncementStore: announce, clear, polite vs assertive slots
 *   - LiveRegion component: renders two sr-only live regions, picks up messages
 *   - usePayrollResultAnnouncer hook: fires both sonner toast and ARIA announcement
 *
 * Edge cases:
 *   - Errors use assertive politeness (interrupts screen-reader speech)
 *   - Success/info/warning use polite politeness
 *   - Store clears after 3 seconds to prevent stale announcements
 */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

import { useAnnouncementStore } from "@/stores/announcements";
import { LiveRegion } from "@/components/ui/LiveRegion";
import { usePayrollResultAnnouncer } from "@/hooks/usePayrollResultAnnouncer";

// Mock sonner so we can assert on calls without a real Toaster
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ── Store unit tests ─────────────────────────────────────────────────────────

describe("useAnnouncementStore", () => {
  beforeEach(() => {
    useAnnouncementStore.setState({ politeMessage: "", assertiveMessage: "" });
  });

  it("starts with empty message slots", () => {
    const { politeMessage, assertiveMessage } = useAnnouncementStore.getState();
    expect(politeMessage).toBe("");
    expect(assertiveMessage).toBe("");
  });

  it("announce() with polite puts message in politeMessage slot", () => {
    act(() => {
      useAnnouncementStore.getState().announce("Proof generated", "polite");
    });
    expect(useAnnouncementStore.getState().politeMessage).toBe("Proof generated");
    expect(useAnnouncementStore.getState().assertiveMessage).toBe("");
  });

  it("announce() with assertive puts message in assertiveMessage slot", () => {
    act(() => {
      useAnnouncementStore.getState().announce("Submission failed", "assertive");
    });
    expect(useAnnouncementStore.getState().assertiveMessage).toBe("Submission failed");
    expect(useAnnouncementStore.getState().politeMessage).toBe("");
  });

  it("announce() defaults to polite when politeness is omitted", () => {
    act(() => {
      useAnnouncementStore.getState().announce("Info message");
    });
    expect(useAnnouncementStore.getState().politeMessage).toBe("Info message");
  });

  it("clear() empties both slots", () => {
    act(() => {
      useAnnouncementStore.getState().announce("a", "polite");
      useAnnouncementStore.getState().announce("b", "assertive");
    });
    act(() => {
      useAnnouncementStore.getState().clear();
    });
    expect(useAnnouncementStore.getState().politeMessage).toBe("");
    expect(useAnnouncementStore.getState().assertiveMessage).toBe("");
  });
});

// ── LiveRegion component tests ───────────────────────────────────────────────

describe("LiveRegion component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAnnouncementStore.setState({ politeMessage: "", assertiveMessage: "" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders two live region containers", () => {
    render(<LiveRegion />);
    expect(screen.getByTestId("live-region-polite")).toBeInTheDocument();
    expect(screen.getByTestId("live-region-assertive")).toBeInTheDocument();
  });

  it("polite region has role=status and aria-live=polite", () => {
    render(<LiveRegion />);
    const polite = screen.getByTestId("live-region-polite");
    expect(polite).toHaveAttribute("role", "status");
    expect(polite).toHaveAttribute("aria-live", "polite");
  });

  it("assertive region has role=alert and aria-live=assertive", () => {
    render(<LiveRegion />);
    const assertive = screen.getByTestId("live-region-assertive");
    expect(assertive).toHaveAttribute("role", "alert");
    expect(assertive).toHaveAttribute("aria-live", "assertive");
  });

  it("injects polite message text into the polite region after 50ms", async () => {
    render(<LiveRegion />);

    act(() => {
      useAnnouncementStore.getState().announce("Payroll submitted successfully", "polite");
    });

    // Before the 50ms debounce fires the text is blank
    expect(screen.getByTestId("live-region-polite").textContent).toBe("");

    // Advance past the debounce
    await act(async () => { vi.advanceTimersByTime(100); });

    expect(screen.getByTestId("live-region-polite").textContent).toBe(
      "Payroll submitted successfully",
    );
  });

  it("injects assertive message text into the assertive region after 50ms", async () => {
    render(<LiveRegion />);

    act(() => {
      useAnnouncementStore.getState().announce("Submission failed. Network timeout.", "assertive");
    });

    await act(async () => { vi.advanceTimersByTime(100); });

    expect(screen.getByTestId("live-region-assertive").textContent).toBe(
      "Submission failed. Network timeout.",
    );
  });

  it("clears the store after 3 seconds so stale messages are not re-announced", async () => {
    render(<LiveRegion />);

    act(() => {
      useAnnouncementStore.getState().announce("Transient message", "polite");
    });

    await act(async () => { vi.advanceTimersByTime(3100); });

    expect(useAnnouncementStore.getState().politeMessage).toBe("");
  });
});

// ── usePayrollResultAnnouncer hook tests ─────────────────────────────────────

describe("usePayrollResultAnnouncer hook", () => {
  beforeEach(() => {
    useAnnouncementStore.setState({ politeMessage: "", assertiveMessage: "" });
    vi.clearAllMocks();
  });

  async function getToast() {
    return await import("sonner").then((m) => m.toast);
  }

  it("announceSuccess fires toast.success and a polite ARIA announcement", async () => {
    const toast = await getToast();
    const { result } = renderHook(() => usePayrollResultAnnouncer());

    act(() => {
      result.current.announceSuccess("Proof generated", "ZK proof is ready.");
    });

    expect(toast.success).toHaveBeenCalledWith("Proof generated", {
      description: "ZK proof is ready.",
    });
    expect(useAnnouncementStore.getState().politeMessage).toBe(
      "Proof generated. ZK proof is ready.",
    );
    expect(useAnnouncementStore.getState().assertiveMessage).toBe("");
  });

  it("announceSuccess without description produces a plain title announcement", async () => {
    const toast = await getToast();
    const { result } = renderHook(() => usePayrollResultAnnouncer());

    act(() => {
      result.current.announceSuccess("Proof generated");
    });

    expect(toast.success).toHaveBeenCalledWith("Proof generated", undefined);
    expect(useAnnouncementStore.getState().politeMessage).toBe("Proof generated");
  });

  it("announceError fires toast.error and an ASSERTIVE ARIA announcement", async () => {
    const toast = await getToast();
    const { result } = renderHook(() => usePayrollResultAnnouncer());

    act(() => {
      result.current.announceError("Submission failed", "Network timeout. Please retry.");
    });

    expect(toast.error).toHaveBeenCalledWith("Submission failed", {
      description: "Network timeout. Please retry.",
    });
    // Errors are assertive so screen readers interrupt
    expect(useAnnouncementStore.getState().assertiveMessage).toBe(
      "Submission failed. Network timeout. Please retry.",
    );
    expect(useAnnouncementStore.getState().politeMessage).toBe("");
  });

  it("announceWarning fires toast.warning and a polite announcement", async () => {
    const toast = await getToast();
    const { result } = renderHook(() => usePayrollResultAnnouncer());

    act(() => {
      result.current.announceWarning("Proof expiring soon");
    });

    expect(toast.warning).toHaveBeenCalledWith("Proof expiring soon", undefined);
    expect(useAnnouncementStore.getState().politeMessage).toBe("Proof expiring soon");
  });

  it("announceInfo fires the default toast and a polite announcement", async () => {
    const toast = await getToast();
    const { result } = renderHook(() => usePayrollResultAnnouncer());

    act(() => {
      result.current.announceInfo("Batch queued");
    });

    expect(toast).toHaveBeenCalledWith("Batch queued", undefined);
    expect(useAnnouncementStore.getState().politeMessage).toBe("Batch queued");
  });
});

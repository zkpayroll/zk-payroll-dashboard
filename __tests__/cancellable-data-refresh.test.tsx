import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useCancellableDataRefresh } from "@/hooks/useCancellableDataRefresh";
import { CancellableRefreshButton } from "@/components/payroll/CancellableRefreshButton";

describe("Cancellable Data Refresh Actions (#519)", () => {
  it("completes data refresh successfully on main path", async () => {
    const fetcher = vi.fn().mockImplementation(async (signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
    });

    const { result } = renderHook(() =>
      useCancellableDataRefresh({ onRefresh: fetcher })
    );

    let success: boolean = false;
    await act(async () => {
      success = await result.current.refresh();
    });

    expect(success).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isCancelled).toBe(false);
    expect(result.current.statusMessage).toBe("Data refreshed successfully.");
    expect(result.current.lastFetchedAt).not.toBeNull();
  });

  it("allows user to cancel long-running refresh while maintaining consistent loading state (edge case)", async () => {
    let abortSignalObserved: AbortSignal | null = null;

    // Simulate a long-running async fetcher that listens to signal abort
    const fetcher = vi.fn().mockImplementation((signal: AbortSignal) => {
      abortSignalObserved = signal;
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const { result } = renderHook(() =>
      useCancellableDataRefresh({ onRefresh: fetcher })
    );

    // Start refresh in background
    let refreshPromise: Promise<boolean>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);
    expect(abortSignalObserved).not.toBeNull();
    expect(abortSignalObserved!.aborted).toBe(false);

    // Cancel mid-flight
    act(() => {
      result.current.cancelRefresh();
    });

    await act(async () => {
      await refreshPromise;
    });

    expect(abortSignalObserved!.aborted).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isCancelled).toBe(true);
    expect(result.current.statusMessage).toBe(
      "Data refresh was cancelled by user."
    );
    expect(result.current.error).toBeNull();
  });

  it("renders CancellableRefreshButton component and supports UI cancel click", async () => {
    let cancelTriggered = false;
    const fetcher = vi.fn().mockImplementation((signal: AbortSignal) => {
      return new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          cancelTriggered = true;
          resolve();
        });
      });
    });

    render(
      <CancellableRefreshButton label="Payroll Runs" onRefresh={fetcher} />
    );

    const triggerBtn = screen.getByTestId("trigger-refresh-button");
    fireEvent.click(triggerBtn);

    // Should now display "Cancel" button
    const cancelBtn = await screen.findByTestId("cancel-refresh-button");
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    const statusMsg = await screen.findByTestId("refresh-status-message");
    expect(statusMsg).toHaveTextContent("Data refresh was cancelled by user.");
    expect(cancelTriggered).toBe(true);
  });
});

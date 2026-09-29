import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  StaleDataIndicator,
} from "@/components/features/payroll/StaleDataIndicator";
import {
  useStaleDataRefresh,
  formatRelativeAge,
} from "@/hooks/useStaleDataRefresh";

function TestWrapper({
  initialLastFetchedAt,
  staleThresholdMs = 300000,
  onRefresh,
  variant = "banner" as const,
  resourceName = "Payroll data",
  hideWhenFresh,
}: {
  initialLastFetchedAt?: string | number | Date | null;
  staleThresholdMs?: number;
  onRefresh?: () => Promise<void> | void;
  variant?: "banner" | "compact";
  resourceName?: string;
  hideWhenFresh?: boolean;
}) {
  const state = useStaleDataRefresh({
    initialLastFetchedAt,
    staleThresholdMs,
    onRefresh,
  });

  return (
    <div>
      <button onClick={() => state.markStale()} data-testid="manual-stale-btn">
        Force Stale
      </button>
      <button onClick={() => state.markFresh()} data-testid="manual-fresh-btn">
        Force Fresh
      </button>
      <StaleDataIndicator
        state={state}
        variant={variant}
        resourceName={resourceName}
        hideWhenFresh={hideWhenFresh}
      />
    </div>
  );
}

describe("formatRelativeAge helper", () => {
  it("formats relative age accurately", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(formatRelativeAge(null, now)).toBe("Unknown");

    const justNow = new Date("2026-09-25T11:59:30Z");
    expect(formatRelativeAge(justNow, now)).toBe("Just now");

    const fiveMinAgo = new Date("2026-09-25T11:55:00Z");
    expect(formatRelativeAge(fiveMinAgo, now)).toBe("5m ago");

    const twoHoursAgo = new Date("2026-09-25T10:00:00Z");
    expect(formatRelativeAge(twoHoursAgo, now)).toBe("2h ago");

    const twoDaysAgo = new Date("2026-09-23T12:00:00Z");
    expect(formatRelativeAge(twoDaysAgo, now)).toBe("2d ago");
  });
});

describe("StaleDataIndicator (#460)", () => {


  it("does not render banner when data is fresh and hideWhenFresh is true", () => {
    const now = new Date();
    render(
      <TestWrapper
        initialLastFetchedAt={now}
        staleThresholdMs={60000}
        hideWhenFresh={true}
      />,
    );

    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });

  it("renders stale indicator banner when elapsed time exceeds threshold", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    render(
      <TestWrapper
        initialLastFetchedAt={tenMinAgo}
        staleThresholdMs={5 * 60 * 1000}
        resourceName="Batch history"
      />,
    );

    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Batch history may be out of date/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/10m ago/i)).toBeInTheDocument();
  });

  it("triggers onRefresh and updates to fresh state upon clicking refresh", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    render(
      <TestWrapper
        initialLastFetchedAt={tenMinAgo}
        staleThresholdMs={5 * 60 * 1000}
        onRefresh={onRefresh}
        hideWhenFresh={true}
      />,
    );

    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();

    const refreshBtn = screen.getByTestId("stale-banner-refresh-btn");
    await act(async () => {
      refreshBtn.click();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // After refresh succeeds, the data is fresh and banner is hidden
    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });

  it("handles refresh failure and displays safe actionable error message", async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error("Network timeout: soroban node unreachable"));
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    render(
      <TestWrapper
        initialLastFetchedAt={tenMinAgo}
        staleThresholdMs={5 * 60 * 1000}
        onRefresh={onRefresh}
      />,
    );

    const refreshBtn = screen.getByTestId("stale-banner-refresh-btn");
    await act(async () => {
      refreshBtn.click();
    });

    expect(screen.getByTestId("stale-error-message")).toBeInTheDocument();
    expect(screen.getByText(/Network timeout: soroban node unreachable/i)).toBeInTheDocument();
    // Verify no private sensitive values or secrets are leaked in error
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument();
  });

  it("supports manual markStale trigger", async () => {
    const now = new Date();
    render(
      <TestWrapper
        initialLastFetchedAt={now}
        staleThresholdMs={60 * 60 * 1000}
        hideWhenFresh={true}
      />,
    );

    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();

    await act(async () => {
      screen.getByTestId("manual-stale-btn").click();
    });

    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();
    expect(screen.getByText(/may be out of date/i)).toBeInTheDocument();
  });

  it("renders compact toolbar variant with accessible button", async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    render(
      <TestWrapper
        initialLastFetchedAt={fiveMinAgo}
        staleThresholdMs={2 * 60 * 1000}
        variant="compact"
        resourceName="Employee roster"
      />,
    );

    expect(screen.getByTestId("stale-data-compact")).toBeInTheDocument();
    expect(screen.getByTestId("stale-badge")).toHaveTextContent("Stale");
    expect(screen.getByLabelText("Refresh Employee roster")).toBeInTheDocument();
  });
});

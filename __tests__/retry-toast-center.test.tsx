import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RetryToastCenter } from "@/components/features/network/RetryToastCenter";
import {
  useNetworkStatusStore,
  executeWithRetry,
} from "@/stores/networkStatus";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";

describe("useNetworkStatusStore", () => {
  beforeEach(() => {
    useNetworkStatusStore.setState({ operations: [] });
    useHelpDrawer.setState({ isOpen: false, currentPage: null, content: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts an operation with pending status and default properties", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Fetch Account Sequence",
    });

    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op).toBeDefined();
    expect(op?.operationName).toBe("Fetch Account Sequence");
    expect(op?.status).toBe("pending");
    expect(op?.isIdempotent).toBe(true);
    expect(op?.attempt).toBe(0);
    expect(op?.maxRetries).toBe(3);
    expect(op?.remediationPage).toBe("network-remediation");
  });

  it("handles non-idempotent operations with default warning", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Submit Payroll Run #101",
      isIdempotent: false,
    });

    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op?.isIdempotent).toBe(false);
    expect(op?.idempotencyWarning).toContain("Non-idempotent operation");
  });

  it("records retry attempts and updates next retry delay and timestamp", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Soroban Simulation",
    });

    useNetworkStatusStore.getState().recordRetry(id, {
      attempt: 1,
      maxRetries: 3,
      nextRetryDelayMs: 2000,
      error: "RPC node timed out",
    });

    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op?.status).toBe("retrying");
    expect(op?.attempt).toBe(1);
    expect(op?.nextRetryDelayMs).toBe(2000);
    expect(op?.lastError).toBe("RPC node timed out");
    expect(op?.nextRetryAt).toBeGreaterThan(Date.now() - 1000);
  });

  it("records success and recovers the operation", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Verify ZK Proof",
    });
    useNetworkStatusStore.getState().recordRetry(id, {
      attempt: 1,
      nextRetryDelayMs: 1000,
      error: "Temporary 503",
    });

    useNetworkStatusStore.getState().recordSuccess(id, 0); // disable auto-dismiss in test
    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op?.status).toBe("recovered");
    expect(op?.nextRetryAt).toBeNull();
    expect(op?.completedAt).toBeDefined();
  });

  it("auto-dismisses recovered operations after timeout", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Fetch Balances",
    });

    useNetworkStatusStore.getState().recordSuccess(id, 3000);
    expect(useNetworkStatusStore.getState().getOperation(id)?.status).toBe("recovered");

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(useNetworkStatusStore.getState().getOperation(id)).toBeUndefined();
  });

  it("records retry exhaustion and final failure state", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Contract Invocation",
    });

    useNetworkStatusStore.getState().recordExhausted(id, {
      error: "HTTP 429 Too Many Requests after 3 retries",
      remediationPage: "network-remediation",
    });

    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op?.status).toBe("exhausted");
    expect(op?.lastError).toBe("HTTP 429 Too Many Requests after 3 retries");
    expect(op?.remediationPage).toBe("network-remediation");
  });

  it("cancels an active operation", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Submit On-Chain",
      isIdempotent: false,
    });

    useNetworkStatusStore.getState().cancelOperation(id, "Cancelled by operator");
    const op = useNetworkStatusStore.getState().getOperation(id);
    expect(op?.status).toBe("cancelled");
    expect(op?.lastError).toBe("Cancelled by operator");
  });

  it("dismisses and clears operations", () => {
    const id1 = useNetworkStatusStore.getState().startOperation({ operationName: "Op 1" });
    const id2 = useNetworkStatusStore.getState().startOperation({ operationName: "Op 2" });

    useNetworkStatusStore.getState().dismissOperation(id1);
    expect(useNetworkStatusStore.getState().getOperation(id1)).toBeUndefined();
    expect(useNetworkStatusStore.getState().getOperation(id2)).toBeDefined();

    useNetworkStatusStore.getState().recordSuccess(id2, 0);
    useNetworkStatusStore.getState().clearCompleted();
    expect(useNetworkStatusStore.getState().operations).toHaveLength(0);
  });
});

describe("executeWithRetry helper utility", () => {
  beforeEach(() => {
    useNetworkStatusStore.setState({ operations: [] });
    vi.useRealTimers();
  });

  it("returns successfully on first attempt without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("success-value");

    const result = await executeWithRetry(fn, {
      operationName: "Quick Query",
    });

    expect(result).toBe("success-value");
    expect(fn).toHaveBeenCalledTimes(1);
    const op = useNetworkStatusStore.getState().operations[0];
    expect(op?.status).toBe("recovered");
  });

  it("retries on transient failure and recovers when fn eventually succeeds", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error("Temporary network glitch");
      }
      return "recovered-data";
    });

    const result = await executeWithRetry(fn, {
      operationName: "Simulate Transaction",
      initialDelayMs: 50,
      backoffMultiplier: 1.5,
      maxRetries: 3,
    });

    expect(result).toBe("recovered-data");
    expect(callCount).toBe(2);
    const op = useNetworkStatusStore.getState().operations[0];
    expect(op?.status).toBe("recovered");
  });

  it("throws error and records exhausted status when max retries exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Persistent RPC outage"));

    await expect(
      executeWithRetry(fn, {
        operationName: "Disburse SAC Token",
        initialDelayMs: 30,
        maxRetries: 2,
      }),
    ).rejects.toThrow("Persistent RPC outage");

    expect(fn).toHaveBeenCalledTimes(3); // Initial attempt + 2 retries
    const op = useNetworkStatusStore.getState().operations[0];
    expect(op?.status).toBe("exhausted");
    expect(op?.lastError).toBe("Persistent RPC outage");
  });
});

describe("RetryToastCenter Component", () => {
  beforeEach(() => {
    useNetworkStatusStore.setState({ operations: [] });
    useHelpDrawer.setState({ isOpen: false, currentPage: null, content: null });
  });

  it("renders nothing when there are no operations in the store", () => {
    const { container } = render(<RetryToastCenter />);
    expect(container.firstChild).toBeNull();
  });

  it("renders retrying state with retry count, operation name, delay, and error message", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Soroban RPC: Verify ZK Proof",
      description: "Batch verification across 15 employees",
      isIdempotent: true,
      maxRetries: 3,
    });

    useNetworkStatusStore.getState().recordRetry(id, {
      attempt: 2,
      maxRetries: 3,
      nextRetryDelayMs: 4000,
      nextRetryAt: Date.now() + 4000,
      error: "RPC Gateway Timeout 504",
    });

    render(<RetryToastCenter />);

    expect(screen.getByText("Soroban RPC: Verify ZK Proof")).toBeInTheDocument();
    expect(screen.getByText("Retry 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Batch verification across 15 employees")).toBeInTheDocument();
    expect(screen.getByText(/Attempt 2 failed: RPC Gateway Timeout 504/)).toBeInTheDocument();
    expect(screen.getByText(/Safe retry: Read-only or idempotent query/)).toBeInTheDocument();
  });

  it("explicitly displays non-idempotent operation warning and provides cancel button", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Submit On-Chain Payroll Batch #42",
      isIdempotent: false,
      maxRetries: 3,
    });

    useNetworkStatusStore.getState().recordRetry(id, {
      attempt: 1,
      nextRetryDelayMs: 5000,
      error: "Horizon connection dropped during submit",
    });

    render(<RetryToastCenter />);

    expect(screen.getByText("Submit On-Chain Payroll Batch #42")).toBeInTheDocument();
    expect(screen.getByText("Non-idempotent operation warning")).toBeInTheDocument();
    expect(
      screen.getByText(/Retrying transaction submission may risk duplicate actions/),
    ).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel retry" });

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(useNetworkStatusStore.getState().getOperation(id)?.status).toBe("cancelled");
  });

  it("renders recovered state when network operation succeeds after retrying", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Account Balance Sync",
    });

    useNetworkStatusStore.getState().recordRetry(id, {
      attempt: 1,
      nextRetryDelayMs: 2000,
      error: "Network unavailable",
    });

    useNetworkStatusStore.getState().recordSuccess(id, 0);

    render(<RetryToastCenter />);

    expect(screen.getByText("Account Balance Sync")).toBeInTheDocument();
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(
      screen.getByText("Network connection restored. The operation completed successfully."),
    ).toBeInTheDocument();
  });

  it("renders cancelled state when operation was aborted", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Submit Batch",
      isIdempotent: false,
    });

    useNetworkStatusStore.getState().cancelOperation(id, "Cancelled by user");

    render(<RetryToastCenter />);

    expect(screen.getByText("Submit Batch")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(
      screen.getByText("Retry cancelled by user. No further automated network attempts will be made."),
    ).toBeInTheDocument();
  });

  it("renders exhausted final failure state and links to remediation drawer", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Soroban Contract Call",
      maxRetries: 3,
      remediationPage: "network-remediation",
      remediationActionLabel: "Open Remediation Guide",
    });

    useNetworkStatusStore.getState().recordExhausted(id, {
      error: "RPC rate limit exceeded (HTTP 429)",
      remediationPage: "network-remediation",
      remediationActionLabel: "Open Remediation Guide",
    });

    render(<RetryToastCenter />);

    expect(screen.getByText("Soroban Contract Call")).toBeInTheDocument();
    expect(screen.getByText("Exhausted")).toBeInTheDocument();
    expect(screen.getByText(/RPC retries exhausted after 3 attempts/)).toBeInTheDocument();
    expect(screen.getByText("RPC rate limit exceeded (HTTP 429)")).toBeInTheDocument();
    expect(
      screen.getByText(/Safe next step: Check network status, review pending transactions/),
    ).toBeInTheDocument();

    const remediationButton = screen.getByRole("button", {
      name: "Open Remediation Guide",
    });
    expect(remediationButton).toBeInTheDocument();

    // Click the remediation action
    fireEvent.click(remediationButton);

    // Verify HelpDrawer state was opened with network-remediation content
    const helpState = useHelpDrawer.getState();
    expect(helpState.isOpen).toBe(true);
    expect(helpState.currentPage).toBe("network-remediation");
    expect(helpState.content?.title).toBe(HELP_CONTENT["network-remediation"].title);
  });

  it("allows user to dismiss individual toasts via close button", () => {
    const id = useNetworkStatusStore.getState().startOperation({
      operationName: "Dismissable Toast",
    });

    render(<RetryToastCenter />);

    expect(screen.getByText("Dismissable Toast")).toBeInTheDocument();
    const dismissButton = screen.getByLabelText("Dismiss notification");
    fireEvent.click(dismissButton);

    expect(useNetworkStatusStore.getState().getOperation(id)).toBeUndefined();
    expect(screen.queryByText("Dismissable Toast")).not.toBeInTheDocument();
  });
});

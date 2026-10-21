import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConcurrentPayrollEditWarningBanner } from "@/components/payroll/ConcurrentPayrollEditWarningBanner";
import {
  createPayrollEditSession,
  evaluateConcurrentPayrollEdits,
  type ConcurrentEditEvaluationResult,
} from "@/src/payroll/concurrentPayrollEditWarning";

describe("ConcurrentPayrollEditWarningBanner component", () => {
  const PAYROLL_ID = "pr_2026_test";
  const OPERATOR = "op_admin_1234";

  it("does not render when hasConflict is false", () => {
    const session = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1);
    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: session,
      latestRemoteVersion: 1,
    });

    render(<ConcurrentPayrollEditWarningBanner evaluation={evaluation} />);
    expect(screen.queryByTestId("concurrent-payroll-edit-warning-banner")).toBeNull();
  });

  it("renders critical version conflict banner with reload button", () => {
    const session = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1);
    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: session,
      latestRemoteVersion: 2,
      latestRemoteEditorId: "op_remote_user",
    });

    render(
      <ConcurrentPayrollEditWarningBanner
        evaluation={evaluation}
        onReloadLatest={vi.fn()}
        onReviewChanges={vi.fn()}
      />,
    );

    const banner = screen.getByTestId("concurrent-payroll-edit-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("data-severity", "critical");
    expect(banner).toHaveAttribute("data-conflict-type", "version_mismatch");

    expect(screen.getByText("Concurrent Payroll Revision Detected")).toBeInTheDocument();
    expect(screen.getByTestId("conflict-code-badge")).toHaveTextContent("VERSION_MISMATCH");
    expect(screen.getByRole("button", { name: /Reload Latest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Changes/i })).toBeInTheDocument();
  });

  it("invokes onReloadLatest when Reload Latest is clicked", async () => {
    const onReloadLatest = vi.fn().mockResolvedValue(undefined);
    const session = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1);
    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: session,
      latestRemoteVersion: 2,
    });

    render(
      <ConcurrentPayrollEditWarningBanner
        evaluation={evaluation}
        onReloadLatest={onReloadLatest}
      />,
    );

    const reloadButton = screen.getByRole("button", { name: /Reload Latest/i });
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(onReloadLatest).toHaveBeenCalledTimes(1);
    });
  });

  it("renders session expired banner with renew session button and invokes onRenewSession", async () => {
    const onRenew = vi.fn().mockResolvedValue(undefined);
    const oldTime = Date.now() - 35 * 60 * 1000;
    const session = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1, undefined, oldTime);
    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: session,
      latestRemoteVersion: 1,
    });

    render(
      <ConcurrentPayrollEditWarningBanner
        evaluation={evaluation}
        onRenewSession={onRenew}
        onReloadLatest={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit Session Expired")).toBeInTheDocument();
    const renewBtn = screen.getByRole("button", { name: /Renew Session/i });
    fireEvent.click(renewBtn);

    await waitFor(() => {
      expect(onRenew).toHaveBeenCalledTimes(1);
    });
  });

  it("renders active editors count badge when peer editors are present", () => {
    const now = Date.now();
    const mySession = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1, "tab_1", now);
    const peer1 = createPayrollEditSession(PAYROLL_ID, "op_alice", 1, "tab_2", now);
    const peer2 = createPayrollEditSession(PAYROLL_ID, "op_bob", 1, "tab_3", now);

    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: mySession,
      latestRemoteVersion: 1,
      activeSessions: [mySession, peer1, peer2],
      now,
    });

    render(<ConcurrentPayrollEditWarningBanner evaluation={evaluation} />);

    expect(screen.getByTestId("active-editors-badge")).toHaveTextContent("3 active");
    expect(screen.getByText("Concurrent Editor Active")).toBeInTheDocument();
  });

  it("allows dismissing non-blocking warnings", () => {
    const now = Date.now();
    const mySession = createPayrollEditSession(PAYROLL_ID, OPERATOR, 1, "tab_1", now);
    const peer = createPayrollEditSession(PAYROLL_ID, "op_alice", 1, "tab_2", now);
    const onDismiss = vi.fn();

    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId: PAYROLL_ID,
      currentSession: mySession,
      latestRemoteVersion: 1,
      activeSessions: [mySession, peer],
      now,
    });

    render(
      <ConcurrentPayrollEditWarningBanner
        evaluation={evaluation}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByLabelText("Dismiss warning");
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("concurrent-payroll-edit-warning-banner")).toBeNull();
  });
});

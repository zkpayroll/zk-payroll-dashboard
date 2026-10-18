import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  captureRecoveryContext,
  evaluateSessionExpiry,
  buildResumePlan,
  type RecoveryContext,
} from "@/src/session/timeoutRecovery";
import { SessionRecoveryBanner } from "@/components/features/session/SessionRecoveryBanner";

const sampleContext: RecoveryContext = {
  workflow: "review",
  route: "/payroll/runs/run_001/review",
  stepLabel: "Step 3 of 5: Review commitments",
  capturedAt: 1_760_000_000_000,
};

describe("Session timeout recovery flow (Issue #269)", () => {
  it("captures a sanitized recovery context (main path)", () => {
    const result = captureRecoveryContext(
      {
        workflow: "review",
        route: "/payroll/runs/run_001/review?amount=150000",
        stepLabel: "Step 3 of 5",
      },
      1_760_000_000_000,
    );

    expect(result.ok).toBe(true);
    expect(result.context?.workflow).toBe("review");
    // Query strings are stripped — amounts must not ride along.
    expect(result.context?.route).toBe("/payroll/runs/run_001/review");
    expect(result.context?.capturedAt).toBe(1_760_000_000_000);
  });

  it("drops non-allowlisted snapshot keys, including sensitive ones", () => {
    const result = captureRecoveryContext(
      {
        workflow: "submission",
        route: "/payroll/runs/run_002/submit",
        salary: 150000,
        amount: 999,
        token: "secret-token",
        stepLabel: "Final confirm",
      },
      1_760_000_000_000,
    );

    expect(result.ok).toBe(true);
    expect(result.droppedKeys).toEqual(
      expect.arrayContaining(["salary", "amount", "token"]),
    );
    expect(JSON.stringify(result.context)).not.toMatch(/150000|999|secret-token/);
  });

  it("rejects snapshots with an invalid workflow or missing route with actionable errors", () => {
    const badWorkflow = captureRecoveryContext({ workflow: "export", route: "/x" });
    expect(badWorkflow.ok).toBe(false);
    expect(badWorkflow.errors.join(" ")).toMatch(/Workflow must be one of/i);

    const missingRoute = captureRecoveryContext({ workflow: "draft" });
    expect(missingRoute.ok).toBe(false);
    expect(missingRoute.errors.join(" ")).toMatch(/Route is required/i);
  });

  it("provides resume guidance only when a context was captured (edge case)", () => {
    const withoutContext = evaluateSessionExpiry(true, null);
    expect(withoutContext.availableActions).not.toContain("resume");
    expect(withoutContext.guidance).toMatch(/Sign in again/i);

    const withContext = evaluateSessionExpiry(true, sampleContext);
    expect(withContext.availableActions).toContain("resume");
    expect(withContext.guidance).toMatch(/Payroll review/);

    const active = evaluateSessionExpiry(false, sampleContext);
    expect(active.isExpired).toBe(false);
    expect(active.guidance).toBe("");
  });

  it("builds a resume plan that re-validates the route and never leaks values", () => {
    const plan = buildResumePlan(sampleContext);
    expect(plan.canResume).toBe(true);
    expect(plan.steps.join(" ")).toMatch(/sign in again/i);
    expect(plan.steps.join(" ")).toMatch(/payroll\/runs\/run_001\/review/);
    expect(JSON.stringify(plan)).not.toContain("salary");

    const noPlan = buildResumePlan(null);
    expect(noPlan.canResume).toBe(false);
    expect(noPlan.statusMessage).toMatch(/restart the payroll flow/i);
  });

  it("renders the recovery banner with resume/restart actions and privacy note", () => {
    const onReauth = vi.fn();
    const onResume = vi.fn();
    const onRestart = vi.fn();

    const { rerender } = render(
      <SessionRecoveryBanner isExpired={false} context={sampleContext} />,
    );
    expect(screen.queryByTestId("session-recovery-banner")).toBeNull();

    rerender(
      <SessionRecoveryBanner
        isExpired
        context={sampleContext}
        onReauth={onReauth}
        onResume={onResume}
        onRestart={onRestart}
      />,
    );

    const banner = screen.getByTestId("session-recovery-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("session-recovery-context").textContent).toMatch(
      /Payroll review/,
    );
    expect(screen.getByTestId("session-resume-steps")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sign in again/i }));
    expect(onReauth).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /resume where i left off/i }),
    );
    expect(onResume).toHaveBeenCalledWith(sampleContext);

    fireEvent.click(screen.getByRole("button", { name: /restart payroll flow/i }));
    expect(onRestart).toHaveBeenCalled();

    expect(banner.textContent).toMatch(/never salary values, amounts, or secrets/i);
  });

  it("hides the resume action when no context was captured", () => {
    render(<SessionRecoveryBanner isExpired context={null} onRestart={vi.fn()} />);

    expect(screen.getByTestId("session-recovery-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("session-resume-steps")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /resume where i left off/i }),
    ).toBeNull();
  });
});

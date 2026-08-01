import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import type { IncidentTimeline as TimelineData } from "@/src/observability/types";

describe("IncidentTimeline Component & Defense In Depth", () => {
  it("renders timeline stages and statuses correctly", () => {
    const mockTimeline: TimelineData = {
      correlationId: "pay_run_ui_test",
      runStatus: "failed",
      totalDurationMs: 450,
      eventCount: 2,
      startedAt: "2026-07-29T16:00:00.000Z",
      endedAt: "2026-07-29T16:00:01.000Z",
      hasFailures: true,
      entries: [
        {
          id: "evt_1",
          sequence: 1,
          timestamp: "2026-07-29T16:00:00.000Z",
          stage: "draft",
          status: "succeeded",
          durationMs: 50,
          redactedContext: { network: "testnet" },
          formattedSummary: "Draft Creation: Created initial payroll draft (succeeded)",
        },
        {
          id: "evt_2",
          sequence: 2,
          timestamp: "2026-07-29T16:00:01.000Z",
          stage: "wallet_signing",
          status: "failed",
          durationMs: 400,
          errorCategory: "user_rejected",
          errorLabel: "wallet_rejected",
          errorMessage: "User declined to sign transaction",
          redactedContext: {
            durationMs: 400,
            errorCategory: "user_rejected",
            errorLabel: "wallet_rejected",
          },
          formattedSummary: "Wallet Signing: Signing failed [user_rejected]",
        },
      ],
    };

    render(<IncidentTimeline timeline={mockTimeline} />);

    expect(screen.getByText("pay_run_ui_test")).toBeDefined();
    expect(screen.getByText("Failed")).toBeDefined();
    expect(screen.getByText("Draft Creation")).toBeDefined();
    expect(screen.getByText("Wallet Signing")).toBeDefined();
    expect(screen.getByText(/User declined to sign transaction/i)).toBeDefined();
  });

  it("defense in depth: never renders raw sensitive values even if present in context", () => {
    const mockTimelineWithLeak: TimelineData = {
      correlationId: "pay_run_leak_test",
      runStatus: "failed",
      totalDurationMs: 100,
      eventCount: 1,
      startedAt: "2026-07-29T16:00:00.000Z",
      endedAt: null,
      hasFailures: true,
      entries: [
        {
          id: "evt_leak",
          sequence: 1,
          timestamp: "2026-07-29T16:00:00.000Z",
          stage: "validation",
          status: "failed",
          durationMs: 100,
          errorCategory: "validation_error",
          errorMessage: "Failed for salary $50,000 and SSN 999-00-1111",
          redactedContext: {
            salary: "[REDACTED]",
            ssn: "[REDACTED]",
            employeeName: "[REDACTED]",
            employeeRefHash: "emp_ref_a1b2c3d4",
          },
          formattedSummary: "Payroll Validation: Validation failed - validation_error",
        },
      ],
    };

    const { container } = render(<IncidentTimeline timeline={mockTimelineWithLeak} />);
    fireEvent.click(screen.getByText("View Redacted Context"));

    const htmlText = container.innerHTML;

    // Check that plaintext SSN, salary amount, and raw names do NOT appear in the rendered HTML
    expect(htmlText).not.toContain("999-00-1111");
    expect(htmlText).not.toContain("$50,000");
    expect(htmlText).toContain("[REDACTED_AMOUNT]");
    expect(htmlText).toContain("[REDACTED_SSN]");
    expect(htmlText).toContain("emp_ref_a1b2c3d4");
  });
});

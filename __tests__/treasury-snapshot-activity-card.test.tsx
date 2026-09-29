import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  calculateTreasurySnapshotHealth,
  MOCK_TREASURY_SNAPSHOT_EVENTS,
  TreasurySnapshotEvent,
} from "@/src/treasury/snapshotActivity";
import { TreasurySnapshotActivityCard } from "@/components/treasury/TreasurySnapshotActivityCard";

describe("Treasury Snapshot Activity Cards (#517)", () => {
  it("calculates healthy treasury snapshot metrics and formats events for main path", () => {
    const health = calculateTreasurySnapshotHealth(
      "USDC",
      100000,
      80000,
      MOCK_TREASURY_SNAPSHOT_EVENTS
    );

    expect(health.status).toBe("healthy");
    expect(health.coveragePercentage).toBe(125);
    expect(health.isHealthy).toBe(true);
    expect(health.warning).toBeNull();
    expect(health.lastSnapshotMerkleRoot).toBe(
      MOCK_TREASURY_SNAPSHOT_EVENTS[0].merkleRoot
    );
  });

  it("handles funding deficit edge case with actionable warning feedback without exposing salaries", () => {
    const deficitHealth = calculateTreasurySnapshotHealth(
      "USDC",
      30000,
      60000, // 50% coverage
      MOCK_TREASURY_SNAPSHOT_EVENTS
    );

    expect(deficitHealth.status).toBe("critical");
    expect(deficitHealth.coveragePercentage).toBe(50);
    expect(deficitHealth.warning).toContain(
      "Critical treasury funding deficit: Coverage is at 50%. Replenish USDC balance before initiating payroll runs."
    );

    render(
      <TreasurySnapshotActivityCard
        assetCode="USDC"
        availableAmount={30000}
        requiredAmount={60000}
      />
    );

    const warningEl = screen.getByTestId("treasury-health-warning");
    expect(warningEl).toBeInTheDocument();
    expect(warningEl.textContent).toContain(
      "Replenish USDC balance before initiating payroll runs."
    );

    // Verify privacy: no raw salary figures displayed
    expect(warningEl.textContent).not.toContain("30000");
    expect(warningEl.textContent).not.toContain("60000");
  });

  it("handles event verification failure edge case gracefully", () => {
    const errorEvent: TreasurySnapshotEvent = {
      id: "evt_err_001",
      timestamp: "2026-09-29T11:00:00Z",
      eventType: "merkle_verified",
      merkleRoot: "0x99999999999999999999",
      assetCode: "USDC",
      employeeCount: 10,
      status: "error",
      description: "Merkle root mismatch detected during background check",
      warningMessage: "On-chain Merkle root does not match snapshot calculation.",
    };

    const healthWithError = calculateTreasurySnapshotHealth(
      "USDC",
      50000,
      50000,
      [errorEvent]
    );

    expect(healthWithError.status).toBe("warning");
    expect(healthWithError.warning).toContain(
      "Recent treasury snapshot event reported a verification error."
    );
  });

  it("renders TreasurySnapshotActivityCard component cleanly with privacy notice", () => {
    render(
      <TreasurySnapshotActivityCard
        assetCode="USDC"
        availableAmount={80000}
        requiredAmount={50000}
      />
    );

    expect(
      screen.getByText("Treasury Health & Snapshot Activity")
    ).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("160%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Treasury metrics display aggregate coverage ratios and Merkle roots only. Individual salaries remain private and encrypted."
      )
    ).toBeInTheDocument();
  });
});

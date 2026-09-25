import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  computeFundingPositions,
  type FundingImbalanceSummary,
} from "@/lib/treasury/fundingBalance";
import FundingImbalanceDashboard from "@/components/features/treasury/FundingImbalanceDashboard";
import type { AssetGroup, StellarAsset } from "@/types/models";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";

function makeGroup(
  code: string,
  issuer: string | undefined,
  required: number,
  available: number,
): AssetGroup {
  const asset: StellarAsset = { code, ...(issuer ? { issuer } : {}) };
  return {
    asset,
    employees: [],
    totalAmount: required,
    transactionCount: 1,
    status: available >= required ? "funded" : "underfunded",
    treasuryReadiness: {
      asset,
      requiredAmount: required,
      availableBalance: available,
      isFunded: available >= required,
      shortfall: Math.max(0, required - available),
    },
  };
}

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("computeFundingPositions", () => {
  it("reports surplus when an asset is overfunded", () => {
    const summary: FundingImbalanceSummary = computeFundingPositions([
      makeGroup("USDC", USDC_ISSUER, 5000, 8000),
    ]);

    expect(summary.positions[0]?.state).toBe("surplus");
    expect(summary.positions[0]?.surplus).toBe(3000);
    expect(summary.isPayrollBlocked).toBe(false);
  });

  it("reports balanced when required equals available exactly", () => {
    const summary = computeFundingPositions([
      makeGroup("USDC", USDC_ISSUER, 5000, 5000),
    ]);

    expect(summary.positions[0]?.state).toBe("balanced");
    expect(summary.positions[0]?.deficit).toBe(0);
    expect(summary.positions[0]?.surplus).toBe(0);
  });

  it("reports deficit and blocks payroll when one asset is short", () => {
    const summary = computeFundingPositions([
      makeGroup("USDC", USDC_ISSUER, 6700, 12000),
      makeGroup("EURC", "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP", 8000, 3500),
    ]);

    expect(summary.isPayrollBlocked).toBe(true);
    expect(summary.blockingAssets).toHaveLength(1);
    expect(summary.blockingAssets[0]?.label).toBe("EURC");
    expect(summary.blockingAssets[0]?.deficit).toBe(4500);
    // Surplus in USDC must not hide the EURC deficit.
    expect(summary.totalSurplus).toBe(5300);
    expect(summary.totalDeficit).toBe(4500);
  });

  it("reduces free balance by reserved amounts and flags the reserved state", () => {
    const summary = computeFundingPositions(
      [makeGroup("USDC", USDC_ISSUER, 5000, 7000)],
      { [`USDC:${USDC_ISSUER}`]: 1500 },
    );

    const position = summary.positions[0];
    expect(position?.reserved).toBe(1500);
    expect(position?.surplus).toBe(500);
    expect(position?.state).toBe("reserved");
    expect(position?.isBlocking).toBe(false);
  });

  it("blocks when reservations push an otherwise covered asset into deficit", () => {
    const summary = computeFundingPositions(
      [makeGroup("USDC", USDC_ISSUER, 5000, 6000)],
      { [`USDC:${USDC_ISSUER}`]: 5500 },
    );

    expect(summary.positions[0]?.state).toBe("deficit");
    expect(summary.positions[0]?.deficit).toBe(4500);
    expect(summary.isPayrollBlocked).toBe(true);
  });

  it("aggregates required amounts for groups sharing the same asset without double counting balances", () => {
    const summary = computeFundingPositions([
      makeGroup("USDC", USDC_ISSUER, 2000, 9000),
      makeGroup("USDC", USDC_ISSUER, 3000, 4000),
    ]);

    expect(summary.positions).toHaveLength(1);
    expect(summary.positions[0]?.required).toBe(5000);
    expect(summary.positions[0]?.available).toBe(9000);
    expect(summary.positions[0]?.state).toBe("surplus");
  });
});

describe("FundingImbalanceDashboard component", () => {
  it("shows blocked state with funding instructions for imbalanced funding", () => {
    render(<FundingImbalanceDashboard groups={MOCK_MULTI_ASSET_RUNS.find((r) => r.id === "mar_003")!.assetGroups} />);

    const overall = screen.getByTestId("funding-overall-status");
    expect(overall).toHaveTextContent(/block payroll execution/i);
    // One alert for the overall status, one per blocking asset card.
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);

    const toggle = screen.getByTestId("toggle-funding-instructions");
    expect(screen.queryByTestId("funding-instructions")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByTestId("funding-instructions")).toBeInTheDocument();
    expect(screen.getByTestId("funding-instructions")).toHaveTextContent(/4,?500\.00 EURC/);
    expect(screen.getByRole("link", { name: /multi-asset payroll planner/i })).toHaveAttribute(
      "href",
      "/payroll/multi-asset",
    );
  });

  it("renders per-asset metrics including required, available, and surplus states", () => {
    render(
      <FundingImbalanceDashboard
        groups={[makeGroup("USDC", USDC_ISSUER, 5000, 8000)]}
      />,
    );

    const card = screen.getByTestId(`asset-funding-card-USDC:${USDC_ISSUER}`);
    expect(card).toHaveAttribute("data-state", "surplus");

    const metrics = screen.getAllByTestId("funding-metric");
    const values = metrics.map((m) => m.textContent);
    expect(values.join(" ")).toContain("5,000.00");
    expect(values.join(" ")).toContain("8,000.00");
    expect(values.join(" ")).toContain("3,000.00");
  });

  it("renders a responsive grid container for many assets", () => {
    render(
      <FundingImbalanceDashboard
        groups={[
          makeGroup("USDC", USDC_ISSUER, 1000, 5000),
          makeGroup("EURC", "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP", 1000, 5000),
          makeGroup("XLM", undefined, 1000, 5000),
          makeGroup("BTC", "GBTCISSUER1111111111111111111111111111111111111111111", 10, 20),
          makeGroup("GBP", "GGBPISSUER22222222222222222222222222222222222222222222", 10, 20),
        ]}
      />,
    );

    const grid = screen.getByTestId("funding-imbalance-dashboard").querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain("grid-cols-1");
    expect(grid?.className).toContain("sm:grid-cols-2");
    expect(grid?.className).toContain("xl:grid-cols-3");
    expect(screen.getAllByTestId(/asset-funding-card-/)).toHaveLength(5);
  });

  it("shows all funded state when no asset has a deficit", () => {
    render(
      <FundingImbalanceDashboard
        groups={[
          makeGroup("USDC", USDC_ISSUER, 1000, 2000),
          makeGroup("XLM", undefined, 1000, 2000),
        ]}
      />,
    );

    expect(screen.getByTestId("funding-overall-status")).toHaveTextContent(
      /All payroll assets are funded/i,
    );
    expect(screen.queryByTestId("toggle-funding-instructions")).not.toBeInTheDocument();
  });

  it("renders empty state when there are no draft groups", () => {
    render(<FundingImbalanceDashboard groups={[]} />);
    expect(screen.getByText(/No draft multi-asset payroll runs/i)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AssetReadinessTable from "@/components/features/treasury/AssetReadinessTable";

describe("AssetReadinessTable", () => {
  it("renders the asset readiness columns and rows for supported payroll assets", () => {
    render(
      <AssetReadinessTable
        rows={[
          {
            assetCode: "USDC",
            availableBalance: 24000,
            reserveThreshold: 25000,
            lastRefresh: "2026-09-25T13:00:00Z",
          },
          {
            assetCode: "XLM",
            availableBalance: 40000,
            reserveThreshold: 25000,
            lastRefresh: "2026-09-25T10:30:00Z",
            warning: "Above reserve threshold",
          },
        ]}
      />,
    );

    expect(screen.getByText("Asset Ready State")).toBeInTheDocument();
    expect(screen.getByText("Asset")).toBeInTheDocument();
    expect(screen.getByText("Available Balance")).toBeInTheDocument();
    expect(screen.getByText("Reserve Warning")).toBeInTheDocument();
    expect(screen.getByText("Last Refresh")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("Below reserve threshold")).toBeInTheDocument();
    expect(screen.getByText("Above reserve threshold")).toBeInTheDocument();
  });
});

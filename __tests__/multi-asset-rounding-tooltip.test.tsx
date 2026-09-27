import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  describeAssetRounding,
  STELLAR_ASSET_DECIMALS,
  STELLAR_MIN_UNIT,
} from "@/lib/payroll/multiAsset";
import { RoundingInfoTooltip } from "@/components/features/payroll/RoundingInfoTooltip";
import MultiAssetPayrollReview from "@/components/features/payroll/MultiAssetPayrollReview";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";

describe("describeAssetRounding (#544)", () => {
  it("explains 7-decimal settlement and bounds the group drift by payment count", () => {
    const r = describeAssetRounding("USDC", 4);
    expect(STELLAR_ASSET_DECIMALS).toBe(7);
    expect(r.summary).toBe("How USDC amounts are rounded");
    expect(r.maxDrift).toBeCloseTo(4 * STELLAR_MIN_UNIT * 0.5, 12);
    expect(r.details.join(" ")).toMatch(/7 decimal places/);
    expect(r.details.join(" ")).toMatch(/Across 4 payments/);
  });

  it("handles single, empty and invalid payment counts", () => {
    expect(describeAssetRounding("XLM", 1).details.join(" ")).toMatch(/single payment/);
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = describeAssetRounding("XLM", bad);
      expect(r.maxDrift).toBe(0);
      expect(r.details.join(" ")).toMatch(/No payments/);
    }
    expect(describeAssetRounding("XLM", 2.9).details.join(" ")).toMatch(/Across 2 payments/);
  });
});

describe("RoundingInfoTooltip (#544)", () => {
  it("is hidden until focused, then linked via aria-describedby", () => {
    render(<RoundingInfoTooltip assetCode="EURC" paymentCount={3} />);
    const button = screen.getByRole("button", { name: "Rounding details for EURC" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(button);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("How EURC amounts are rounded");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("toggles on click and closes on Escape", () => {
    render(<RoundingInfoTooltip assetCode="EURC" paymentCount={3} />);
    const button = screen.getByRole("button", { name: "Rounding details for EURC" });
    fireEvent.click(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows one tooltip trigger per asset total in the multi-asset review", () => {
    const run = MOCK_MULTI_ASSET_RUNS[0];
    render(<MultiAssetPayrollReview run={run} onSubmit={() => {}} />);
    for (const group of run.assetGroups) {
      expect(
        screen.getByRole("button", { name: `Rounding details for ${group.asset.code}` }),
      ).toBeInTheDocument();
    }
  });

  it("never includes individual payment amounts in the tooltip", () => {
    const run = MOCK_MULTI_ASSET_RUNS[0];
    render(<MultiAssetPayrollReview run={run} onSubmit={() => {}} />);
    const group = run.assetGroups[0];
    fireEvent.focus(screen.getByRole("button", { name: `Rounding details for ${group.asset.code}` }));
    const text = screen.getByRole("tooltip").textContent ?? "";
    for (const emp of group.employees) {
      expect(text).not.toContain(String(emp.amount));
    }
  });
});

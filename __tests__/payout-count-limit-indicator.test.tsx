import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getPayoutLimitStatus } from "@/lib/payroll/payoutLimit";
import { PayoutCountLimitIndicator } from "@/components/features/payroll/PayoutCountLimitIndicator";

describe("getPayoutLimitStatus (#542)", () => {
  it("classifies ok / near / at / over against the limit", () => {
    expect(getPayoutLimitStatus(10, 500)).toMatchObject({ state: "ok", remaining: 490, blocking: false });
    expect(getPayoutLimitStatus(400, 500)).toMatchObject({ state: "near", remaining: 100 });
    expect(getPayoutLimitStatus(500, 500)).toMatchObject({ state: "at", remaining: 0, blocking: false });
    expect(getPayoutLimitStatus(1001, 500)).toMatchObject({
      state: "over",
      remaining: 0,
      percent: 100,
      batchesNeeded: 3,
      blocking: true,
    });
  });

  it("handles empty runs and a missing or invalid limit", () => {
    expect(getPayoutLimitStatus(0, 500)).toMatchObject({ state: "ok", batchesNeeded: 0 });
    expect(getPayoutLimitStatus(-4, 500).count).toBe(0);
    for (const bad of [0, -1, Number.NaN]) {
      expect(getPayoutLimitStatus(20, bad)).toMatchObject({ state: "unconfigured", blocking: false });
    }
  });
});

describe("PayoutCountLimitIndicator (#542)", () => {
  it("shows the count against the limit as a status", () => {
    render(<PayoutCountLimitIndicator count={12} limit={500} />);
    const box = screen.getByTestId("payout-limit-indicator");
    expect(box).toHaveAttribute("data-state", "ok");
    expect(box).toHaveAttribute("role", "status");
    expect(box).toHaveTextContent("12 / 500");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "12");
  });

  it("raises an alert with remediation when the run is over the limit", () => {
    render(<PayoutCountLimitIndicator count={7} limit={5} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-state", "over");
    expect(alert).toHaveTextContent(/exceeds the 5-payout batch limit by 2/);
    expect(alert).toHaveTextContent(/Split it into 2 batches/);
  });

  it("warns when approaching the limit", () => {
    render(<PayoutCountLimitIndicator count={9} limit={10} />);
    expect(screen.getByTestId("payout-limit-indicator")).toHaveTextContent(/1 payout remaining/);
  });
});

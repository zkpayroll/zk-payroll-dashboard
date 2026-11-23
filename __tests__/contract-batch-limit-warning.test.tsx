import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CONTRACT_MAX_PAYOUT_BATCH_SIZE,
  getContractBatchLimitStatus,
} from "@/lib/payroll/contractBatchLimit";
import { ContractBatchLimitWarning } from "@/components/features/payroll/ContractBatchLimitWarning";

describe("getContractBatchLimitStatus (#752)", () => {
  it("uses the contract limit of 50 by default", () => {
    expect(CONTRACT_MAX_PAYOUT_BATCH_SIZE).toBe(50);
    expect(getContractBatchLimitStatus(10)).toMatchObject({ state: "ok", remaining: 40, submissionsNeeded: 1 });
  });

  it("classifies the boundaries around the limit", () => {
    expect(getContractBatchLimitStatus(39).state).toBe("ok");
    expect(getContractBatchLimitStatus(40).state).toBe("near");
    expect(getContractBatchLimitStatus(50)).toMatchObject({ state: "at", remaining: 0, excess: 0 });
    expect(getContractBatchLimitStatus(51)).toMatchObject({ state: "exceeds", excess: 1, submissionsNeeded: 2 });
    expect(getContractBatchLimitStatus(101).submissionsNeeded).toBe(3);
  });

  it("handles empty, negative and non-finite counts", () => {
    expect(getContractBatchLimitStatus(0)).toMatchObject({ state: "ok", submissionsNeeded: 0 });
    expect(getContractBatchLimitStatus(-5).count).toBe(0);
    expect(getContractBatchLimitStatus(Number.NaN).count).toBe(0);
  });

  it("flags a policy limit above the contract limit", () => {
    expect(getContractBatchLimitStatus(10, 500).policyAboveContractLimit).toBe(true);
    expect(getContractBatchLimitStatus(10, 50).policyAboveContractLimit).toBe(false);
    expect(getContractBatchLimitStatus(10, null).policyAboveContractLimit).toBe(false);
  });
});

describe("ContractBatchLimitWarning (#752)", () => {
  it("renders nothing for a small run under a policy within the contract limit", () => {
    const { container } = render(<ContractBatchLimitWarning count={10} policyMaxBatchSize={50} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns that a run over the limit will be split", () => {
    render(<ContractBatchLimitWarning count={120} policyMaxBatchSize={500} />);
    const box = screen.getByTestId("contract-batch-limit-warning");
    expect(box).toHaveAttribute("data-state", "exceeds");
    expect(box).toHaveTextContent(/70 over the contract limit of 50/);
    expect(box).toHaveTextContent(/3 submissions/);
    expect(box).toHaveTextContent(/Lower the maximum batch size/);
  });

  it("warns when exactly at the limit and when approaching it", () => {
    const { rerender } = render(<ContractBatchLimitWarning count={50} />);
    expect(screen.getByTestId("contract-batch-limit-warning")).toHaveAttribute("data-state", "at");
    rerender(<ContractBatchLimitWarning count={45} />);
    expect(screen.getByTestId("contract-batch-limit-warning")).toHaveTextContent(/5 remaining/);
  });

  it("notes a policy above the contract limit even for a small run", () => {
    render(<ContractBatchLimitWarning count={5} policyMaxBatchSize={500} />);
    expect(screen.getByTestId("contract-batch-limit-warning")).toHaveTextContent(
      /policy allows 500 payouts per batch, above the contract limit of 50/
    );
  });

  it("shows only counts, never names or amounts", () => {
    render(<ContractBatchLimitWarning count={60} policyMaxBatchSize={500} />);
    expect(screen.getByTestId("contract-batch-limit-warning").textContent).not.toMatch(/\$|G[A-Z0-9]{20,}/);
  });
});

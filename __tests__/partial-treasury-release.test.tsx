import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { summarizePartialRelease, type PartialReleaseFailure } from "@/lib/treasury/partialRelease";
import PartialReleaseFailureAlert from "@/components/features/treasury/PartialReleaseFailureAlert";
import TreasuryView from "@/components/features/treasury/TreasuryView";
import IncidentsPage from "@/app/incidents/page";

const PARTIAL: PartialReleaseFailure = {
  releaseId: "rel_001",
  requested: 12,
  released: 9,
  failures: [
    { reason: "timeout", count: 1 },
    { reason: "insufficient_balance", count: 2 },
  ],
};

describe("summarizePartialRelease (#760)", () => {
  it("counts released and failed items and orders steps by count", () => {
    const summary = summarizePartialRelease(PARTIAL);
    expect(summary).toMatchObject({ requested: 12, released: 9, failed: 3, isPartial: true, anyRetryable: true });
    expect(summary.steps.map((s) => s.reason)).toEqual(["insufficient_balance", "timeout"]);
  });

  it("merges repeated reasons and maps unknown reasons to 'unknown'", () => {
    const summary = summarizePartialRelease({
      releaseId: "r",
      requested: 5,
      released: 1,
      failures: [
        { reason: "timeout", count: 1 },
        { reason: "timeout", count: 2 },
        { reason: "weird_code", count: 1 },
      ],
    });
    expect(summary.steps).toEqual([
      expect.objectContaining({ reason: "timeout", count: 3 }),
      expect.objectContaining({ reason: "unknown", count: 1 }),
    ]);
  });

  it("is not partial when nothing was released or nothing failed", () => {
    expect(summarizePartialRelease({ releaseId: "r", requested: 3, released: 0, failures: [{ reason: "timeout", count: 3 }] }).isPartial).toBe(false);
    expect(summarizePartialRelease({ releaseId: "r", requested: 3, released: 3, failures: [] })).toMatchObject({ failed: 0, isPartial: false });
  });

  it("counts failures the contract did not explain", () => {
    expect(summarizePartialRelease({ releaseId: "r", requested: 10, released: 6, failures: [] }).failed).toBe(4);
  });

  it("ignores negative, fractional-garbage and non-finite counts", () => {
    const s = summarizePartialRelease({
      releaseId: "r",
      requested: Number.NaN,
      released: -2,
      failures: [{ reason: "timeout", count: -1 }, { reason: "timeout", count: Number.NaN }],
    });
    expect(s).toMatchObject({ requested: 0, released: 0, failed: 0 });
  });
});

describe("PartialReleaseFailureAlert (#760)", () => {
  it("states what was released, what failed and what to do next", () => {
    render(<PartialReleaseFailureAlert failure={PARTIAL} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-partial", "true");
    expect(screen.getByText("Treasury release partially failed")).toBeInTheDocument();
    expect(screen.getByTestId("partial-release-counts")).toHaveTextContent("9 of 12 released, 3 failed");
    expect(screen.getByTestId("release-failure-insufficient_balance")).toHaveTextContent(/Fund the treasury/);
    expect(screen.getByTestId("release-failure-timeout")).toHaveTextContent(/Check the transaction status before retrying/);
  });

  it("flags failures with no reported reason and points to the incident log", () => {
    render(<PartialReleaseFailureAlert failure={{ releaseId: "rel_9", requested: 4, released: 2, failures: [] }} />);
    expect(screen.getByTestId("release-failure-unaccounted")).toHaveTextContent(/No reason reported \(2\)/);
  });

  it("renders nothing when everything was released", () => {
    const { container } = render(
      <PartialReleaseFailureAlert failure={{ releaseId: "r", requested: 2, released: 2, failures: [] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never shows recipients, addresses or amounts", () => {
    render(<PartialReleaseFailureAlert failure={PARTIAL} />);
    expect(screen.getByTestId("partial-release-failure").textContent).not.toMatch(/\$|\bG[A-Z0-9]{20,}\b/);
  });
});

describe("partial release wiring (#760)", () => {
  it("TreasuryView shows each failure it is given and none by default", () => {
    const { unmount } = render(<TreasuryView releaseFailures={[PARTIAL]} />);
    expect(screen.getByTestId("partial-release-failure")).toBeInTheDocument();
    unmount();
    render(<TreasuryView />);
    expect(screen.queryByTestId("partial-release-failure")).toBeNull();
  });

  it("the incidents page lists partial release failures", () => {
    render(<IncidentsPage />);
    expect(screen.getByTestId("partial-release-failure")).toBeInTheDocument();
  });
});

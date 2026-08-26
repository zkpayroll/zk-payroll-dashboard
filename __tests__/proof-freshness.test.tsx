import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  evaluateProofFreshness,
  formatProofCountdown,
  PROOF_EXPIRING_WINDOW_MS,
} from "@/lib/formatting/proofFreshness";
import ProofFreshnessBadge from "@/components/features/proofs/ProofFreshnessBadge";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";

const NOW = Date.parse("2026-08-20T12:00:00Z");

function ref(expiresAt: string, proofStatus: "verified" | "pending" | "failed" | "expired" = "verified") {
  return { expiresAt, proofStatus };
}

describe("evaluateProofFreshness", () => {
  it("treats a missing reference as missing", () => {
    const evaluation = evaluateProofFreshness({ reference: null }, NOW);
    expect(evaluation.state).toBe("missing");
    expect(evaluation.blocksExecution).toBe(false);
  });

  it("marks proofs comfortably ahead of expiry as fresh", () => {
    const evaluation = evaluateProofFreshness(
      { reference: ref(new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString()) },
      NOW,
    );
    expect(evaluation.state).toBe("fresh");
    expect(evaluation.blocksExecution).toBe(false);
    expect(evaluation.remainingMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("flags proofs inside the expiry window as expiring without blocking", () => {
    const evaluation = evaluateProofFreshness(
      { reference: ref(new Date(NOW + 5 * 60 * 60 * 1000).toISOString()) },
      NOW,
    );
    expect(evaluation.state).toBe("expiring");
    expect(evaluation.blocksExecution).toBe(false);
    expect(evaluation.remainingMs).toBeLessThanOrEqual(PROOF_EXPIRING_WINDOW_MS);
  });

  it("flags past-expiry proofs as expired and blocking", () => {
    const evaluation = evaluateProofFreshness(
      { reference: ref(new Date(NOW - 1000).toISOString()) },
      NOW,
    );
    expect(evaluation.state).toBe("expired");
    expect(evaluation.blocksExecution).toBe(true);
  });

  it("honors an explicit on-chain expired status even if the date is in the future", () => {
    const evaluation = evaluateProofFreshness(
      { reference: ref(new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(), "expired") },
      NOW,
    );
    expect(evaluation.state).toBe("expired");
    expect(evaluation.blocksExecution).toBe(true);
  });

  it("formats countdowns in hours/minutes/seconds buckets", () => {
    expect(formatProofCountdown(23 * 3600 * 1000 + 59 * 60 * 1000)).toBe("23h 59m");
    expect(formatProofCountdown(45 * 60 * 1000 + 12 * 1000)).toBe("45m 12s");
    expect(formatProofCountdown(30 * 1000)).toBe("30s");
  });
});

describe("ProofFreshnessBadge component", () => {
  const cases: Array<{
    name: string;
    reference: { expiresAt: string; proofStatus: "verified" | "pending" | "failed" | "expired" } | null;
    expectedState: string;
  }> = [
    { name: "fresh", reference: ref(new Date(NOW + 10 * 24 * 60 * 60 * 1000).toISOString()), expectedState: "fresh" },
    { name: "expiring", reference: ref(new Date(NOW + 3 * 60 * 60 * 1000).toISOString()), expectedState: "expiring" },
    { name: "expired", reference: ref(new Date(NOW - 60 * 60 * 1000).toISOString()), expectedState: "expired" },
    { name: "missing", reference: null, expectedState: "missing" },
  ];

  for (const testCase of cases) {
    it(`renders the ${testCase.name} state with distinct styling`, () => {
      render(
        <ProofFreshnessBadge
          key={testCase.name}
          reference={testCase.reference}
          now={NOW}
        />,
      );
      expect(screen.getByTestId(`proof-freshness-${testCase.expectedState}`)).toBeInTheDocument();
    });
  }

  it("shows a countdown for fresh proofs and operator guidance messages", () => {
    render(
      <ProofFreshnessBadge
        reference={ref(new Date(NOW + 2 * 24 * 60 * 60 * 1000 - 1000).toISOString())}
        now={NOW}
      />,
    );
    expect(screen.getByText(/1d|47h|48h/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Proof status: Proof fresh",
    );
  });

  it("shows replacement guidance for expiring proofs", () => {
    render(
      <ProofFreshnessBadge
        reference={ref(new Date(NOW + 2 * 60 * 60 * 1000).toISOString())}
        now={NOW}
      />,
    );

    expect(screen.getByText(/expires soon/i)).toBeInTheDocument();
    expect(screen.getByTestId("proof-replacement-link")).toHaveAttribute(
      "href",
      "/payroll/execute",
    );
  });

  it("tells operators what to do when a proof is expired", () => {
    render(<ProofFreshnessBadge reference={ref(new Date(NOW - 1000).toISOString())} now={NOW} />);

    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
    expect(screen.getByTestId("proof-replacement-link")).toBeInTheDocument();
  });

  it("explains that no proof exists yet when the reference is missing", () => {
    render(<ProofFreshnessBadge reference={null} now={NOW} />);

    expect(screen.getByText(/No proof is attached yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("proof-replacement-link")).not.toBeInTheDocument();
  });
});

describe("ProofFreshnessBadge integration in payroll run detail", () => {
  it("renders the freshness badge inside the run metadata when proof metadata is present", () => {
    const run = {
      id: "tx_099",
      companyId: "company_001",
      timestamp: "2026-08-01T09:00:00Z",
      createdAt: "2026-08-01T09:00:00Z",
      totalAmount: 9500,
      employeeCount: 2,
      proof: "0xzkproof_integration",
      status: "failed" as const,
      employeeIds: [],
      executedAt: null,
      transactionHash: null,
    };

    render(
      <PayrollRunDetail
        run={run}
        proofReference={{
          proofId: "zkp_ref_099",
          verifierContract: "CCVERIFIER",
          circuitHash: "0xcircuit",
          publicSignalsDigest: "0xdigest",
          proofStatus: "expired",
          expiresAt: new Date(NOW - 1000).toISOString(),
          rawProofHash: "0xraw",
        }}
      />,
    );

    expect(screen.getByTestId("proof-freshness-expired")).toBeInTheDocument();
    expect(screen.getByTestId("proof-replacement-link")).toBeInTheDocument();
    // Expired proofs must block execution actions.
    expect(evaluateProofFreshness({
      reference: { expiresAt: new Date(NOW - 1000).toISOString(), proofStatus: "expired" },
    }, NOW).blocksExecution).toBe(true);
  });
});

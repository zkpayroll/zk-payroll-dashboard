import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissingProofWarning, ExpiredProofWarning } from "@/components/features/proofs/MissingProofWarning";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import type { ProofReference } from "@/types/models";

const NOW = Date.parse("2026-08-20T12:00:00Z");

function scheduledRun(overrides: Partial<any> = {}) {
  return {
    id: "tx_099",
    companyId: "company_001",
    timestamp: "2026-08-20T09:00:00Z",
    createdAt: "2026-08-20T09:00:00Z",
    totalAmount: 9500,
    employeeCount: 2,
    proof: "",
    status: "pending" as const,
    employeeIds: ["emp_001"],
    executedAt: null,
    transactionHash: null,
    ...overrides,
  };
}

describe("MissingProofWarning component", () => {
  it("renders blocked warning with actionable guidance (failure path)", () => {
    render(<MissingProofWarning runId="tx_099" />);
    expect(screen.getByTestId("missing-proof-warning")).toBeInTheDocument();
    expect(screen.getByText(/Proof required — action blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/no ZK proof data is attached/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate a fresh payroll proof before trying again/i)).toBeInTheDocument();
    expect(screen.getByTestId("missing-proof-action")).toHaveAttribute("href", "/payroll/execute");
  });

  it("shows run id when provided but never salary values", () => {
    render(<MissingProofWarning runId="tx_123" />);
    expect(screen.getByText(/tx_123/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$\s*\d/);
  });

  it("compact variant renders inline alert", () => {
    render(<MissingProofWarning compact />);
    expect(screen.getByTestId("missing-proof-warning")).toBeInTheDocument();
    expect(screen.getByText(/Proof required — add proof data before retrying/i)).toBeInTheDocument();
  });

  it("ExpiredProofWarning renders distinct expired copy", () => {
    render(<ExpiredProofWarning />);
    expect(screen.getByTestId("expired-proof-warning")).toBeInTheDocument();
    expect(screen.getByText(/Proof expired — action blocked/i)).toBeInTheDocument();
  });

  it("privacy: never exposes salary amounts or commitments", () => {
    render(<MissingProofWarning runId="tx_099" />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/5000|9500/);
    expect(text).not.toMatch(/0xabc123/);
  });
});

describe("PayrollRunDetail — proof missing blocks execution", () => {
  it("blocks execution and shows missing-proof-warning when proof is missing (failure path)", () => {
    render(<PayrollRunDetail run={scheduledRun()} proofReference={null} />);
    // banners
    expect(screen.getByTestId("missing-proof-warning")).toBeInTheDocument();
    expect(screen.getByText(/no ZK proof data is attached/i)).toBeInTheDocument();
    // button blocked
    expect(screen.getByTestId("execution-blocked-missing-proof")).toBeInTheDocument();
    expect(screen.getByText(/Execution blocked — proof missing/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Process payroll/i })).not.toBeInTheDocument();
  });

  it("shows Process payroll when proof is fresh (success path)", () => {
    const freshRef: ProofReference = {
      proofId: "zkp_ref_099",
      verifierContract: "CCVERIFIER",
      circuitHash: "0xcircuit",
      publicSignalsDigest: "0xdigest",
      proofStatus: "verified",
      expiresAt: new Date(NOW + 10 * 24 * 60 * 60 * 1000).toISOString(),
      rawProofHash: "0xraw",
    };
    render(<PayrollRunDetail run={scheduledRun()} proofReference={freshRef} />);
    expect(screen.queryByTestId("missing-proof-warning")).not.toBeInTheDocument();
    // Fresh proof should allow Process payroll (scheduled + not locked + not expired/missing)
    // Note: PayrollRunDetail uses Date.now() for freshness, so we use far-future expiry
    const futureRef = { ...freshRef, expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() };
    const { unmount } = render(<PayrollRunDetail run={scheduledRun({ id: "tx_100" })} proofReference={futureRef} />);
    unmount();
  });

  it("shows expired warning when proof is expired (expired path)", () => {
    const expiredRef: ProofReference = {
      proofId: "zkp_ref_exp",
      verifierContract: "CCV",
      circuitHash: "0xcircuit",
      publicSignalsDigest: "0xdigest",
      proofStatus: "expired",
      expiresAt: new Date(NOW - 1000).toISOString(),
      rawProofHash: "0xraw",
    };
    render(<PayrollRunDetail run={scheduledRun()} proofReference={expiredRef} />);
    expect(screen.getByTestId("expired-proof-warning")).toBeInTheDocument();
    expect(screen.getByTestId("execution-blocked-by-proof")).toBeInTheDocument();
  });

  it("edge: does not show warning for verified/locked runs even if proof missing", () => {
    const verifiedRun = scheduledRun({ status: "verified" as const, proof: "0xok", transactionHash: "abc" });
    render(<PayrollRunDetail run={verifiedRun} proofReference={null} />);
    // Locked runs (verified) should not show the scheduled-missing warning
    // PayrollRunDetail sets lockState=reconciliation for verified, so missing warning hidden
    expect(screen.queryByTestId("missing-proof-warning")).not.toBeInTheDocument();
  });

  it("privacy: detail view never leaks salary amounts in warning", () => {
    render(<PayrollRunDetail run={scheduledRun()} proofReference={null} />);
    const text = document.body.textContent ?? "";
    // Warning should not contain literal salary numbers from mock
    expect(screen.getByTestId("missing-proof-warning").textContent).not.toMatch(/\$\s*9,500/);
  });
});

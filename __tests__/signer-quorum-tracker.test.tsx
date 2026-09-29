import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import SignerQuorumTracker from "@/components/features/approvals/SignerQuorumTracker";
import { useSigningStore, computeProgress } from "@/stores/signing";
import type { Signer } from "@/stores/signing";
import type { SignerRole } from "@/types/roles";

const REQUIRED_ROLES: SignerRole[] = ["owner", "finance", "compliance"];

function makeSigners(overrides: Partial<Record<SignerRole, Signer["status"]>>): Signer[] {
  return REQUIRED_ROLES.map((role, i) => ({
    id: `signer_${i}`,
    name: `Signer ${role}`,
    role,
    status: overrides[role] ?? "missing",
  }));
}

function seed(partial: {
  mode?: "threshold" | "unanimous";
  threshold?: number;
  requiredRoles?: SignerRole[];
  signers?: Signer[];
}) {
  useSigningStore.setState({
    mode: "threshold",
    threshold: 2,
    requiredRoles: REQUIRED_ROLES,
    signers: makeSigners({}),
    ...partial,
  });
}

describe("computeProgress", () => {
  it("meets the threshold once enough valid signatures are collected", () => {
    const progress = computeProgress({
      mode: "threshold",
      threshold: 2,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed" }),
    });
    expect(progress.collected).toBe(2);
    expect(progress.thresholdMet).toBe(true);
    // still blocked because compliance role is missing
    expect(progress.missingRoles).toEqual(["compliance"]);
    expect(progress.blocked).toBe(true);
  });

  it("is unblocked when all required roles have signed", () => {
    const progress = computeProgress({
      mode: "threshold",
      threshold: 2,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "signed" }),
    });
    expect(progress.thresholdMet).toBe(true);
    expect(progress.missingRoles).toEqual([]);
    expect(progress.blocked).toBe(false);
  });

  it("requires every role in unanimous mode", () => {
    const progress = computeProgress({
      mode: "unanimous",
      threshold: 1,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed" }),
    });
    expect(progress.required).toBe(3);
    expect(progress.thresholdMet).toBe(false);
    expect(progress.blocked).toBe(true);
  });

  it("blocks submission when an approval is rejected", () => {
    const progress = computeProgress({
      mode: "threshold",
      threshold: 2,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "rejected" }),
    });
    expect(progress.rejected).toHaveLength(1);
    expect(progress.blocked).toBe(true);
  });

  it("blocks submission when an approval is expired", () => {
    const progress = computeProgress({
      mode: "threshold",
      threshold: 2,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "expired" }),
    });
    expect(progress.expired).toHaveLength(1);
    expect(progress.blocked).toBe(true);
  });

  it("flags unauthorized signers", () => {
    const progress = computeProgress({
      mode: "threshold",
      threshold: 2,
      requiredRoles: REQUIRED_ROLES,
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "unauthorized" }),
    });
    expect(progress.unauthorized).toHaveLength(1);
    expect(progress.blocked).toBe(true);
  });
});

describe("SignerQuorumTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSigningStore.setState({ ...useSigningStore.getState() });
  });

  it("renders heading and description", () => {
    seed({ signers: makeSigners({}) });
    render(<SignerQuorumTracker />);
    expect(screen.getByText("Signer Quorum")).toBeInTheDocument();
    expect(screen.getByText(/Track required approvals/)).toBeInTheDocument();
  });

  it("shows threshold progress count", () => {
    seed({ signers: makeSigners({ owner: "signed" }) });
    render(<SignerQuorumTracker />);
    expect(screen.getByText(/1\/2 signatures/)).toBeInTheDocument();
  });

  it("shows blocked banner when quorum is not met", () => {
    seed({ signers: makeSigners({ owner: "signed" }) });
    render(<SignerQuorumTracker />);
    expect(screen.getByText("Submission blocked")).toBeInTheDocument();
  });

  it("shows a rejected-approval message that blocks submission", () => {
    seed({
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "rejected" }),
    });
    render(<SignerQuorumTracker />);
    expect(screen.getByText("Submission blocked")).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it("shows an expired-approval message that blocks submission", () => {
    seed({
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "expired" }),
    });
    render(<SignerQuorumTracker />);
    expect(screen.getByText("Submission blocked")).toBeInTheDocument();
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it("shows ready-to-submit banner when quorum is fully met", () => {
    seed({
      signers: makeSigners({ owner: "signed", finance: "signed", compliance: "signed" }),
    });
    render(<SignerQuorumTracker />);
    expect(screen.getByText(/Quorum reached/)).toBeInTheDocument();
  });

  it("lists missing roles awaiting approval", () => {
    seed({ signers: makeSigners({ owner: "signed" }) });
    render(<SignerQuorumTracker />);
    expect(screen.getByText("Awaiting approval (2)")).toBeInTheDocument();
  });

  it("copies the request summary to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    seed({ signers: makeSigners({ owner: "signed" }) });
    render(<SignerQuorumTracker />);
    fireEvent.click(screen.getByText("Copy request summary"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const summary = writeText.mock.calls[0][0] as string;
    expect(summary).toContain("Payroll approval request");
    expect(summary).toContain("Still needed from");
  });
});

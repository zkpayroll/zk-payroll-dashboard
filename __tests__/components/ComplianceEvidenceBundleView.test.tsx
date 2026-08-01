import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ComplianceEvidenceBundleView from "@/components/features/compliance/ComplianceEvidenceBundleView";
import { useEvidenceBundleStore } from "@/stores/evidenceBundles";
import { MOCK_COMPLIANCE_EVIDENCE_BUNDLES } from "@/lib/api/mockData";

describe("ComplianceEvidenceBundleView Component", () => {
  beforeEach(() => {
    useEvidenceBundleStore.setState({
      bundles: MOCK_COMPLIANCE_EVIDENCE_BUNDLES,
      selectedBundleId: MOCK_COMPLIANCE_EVIDENCE_BUNDLES[0].bundleId,
    });
  });

  it("renders evidence bundle view header and privacy classification badges", () => {
    render(<ComplianceEvidenceBundleView />);

    expect(screen.getByText("Compliance Evidence Bundles")).toBeInTheDocument();
    expect(screen.getByText("Zero-Knowledge Audit-Safe")).toBeInTheDocument();
    expect(screen.getByText("Redacted Remuneration Inputs")).toBeInTheDocument();
  });

  it("renders active bundle summary cards correctly", () => {
    render(<ComplianceEvidenceBundleView />);

    expect(screen.getByText("VERIFICATION STATUS")).toBeInTheDocument();
    expect(screen.getByText("ZK PROOF REFERENCE")).toBeInTheDocument();
    expect(screen.getByText("AUDIT DISBURSEMENT")).toBeInTheDocument();
    expect(screen.getByText("SETTLEMENT LEDGER")).toBeInTheDocument();
  });

  it("enforces privacy by redacting recipient commitment hashes by default", () => {
    render(<ComplianceEvidenceBundleView />);

    // Check for redacted commitment text
    expect(screen.getAllByText(/REDACTED/i).length).toBeGreaterThan(0);
  });

  it("toggles commitment reveal when reveal button is clicked", () => {
    render(<ComplianceEvidenceBundleView />);

    const revealButtons = screen.getAllByTitle(/reveal full commitment hash/i);
    expect(revealButtons.length).toBeGreaterThan(0);

    // Click reveal button
    fireEvent.click(revealButtons[0]);

    // Full commitment hash should now be rendered
    const hash = MOCK_COMPLIANCE_EVIDENCE_BUNDLES[0].receipts[0].recipientCommitments[0];
    expect(screen.getByText(new RegExp(hash, "i"))).toBeInTheDocument();
  });

  it("switches tabs between Receipts, ZK Proof Reference, Transaction Metadata, and Approval History", () => {
    render(<ComplianceEvidenceBundleView />);

    // Default tab is Receipts
    expect(screen.getByText(/Privacy Rule Enforcement/i)).toBeInTheDocument();

    // Switch to ZK Proof tab
    const proofTab = screen.getByRole("button", { name: /ZK Proof Reference/i });
    fireEvent.click(proofTab);
    expect(screen.getByText("Zero-Knowledge Proof Artifacts")).toBeInTheDocument();
    expect(screen.getByText("Raw ZK Proof Digest")).toBeInTheDocument();

    // Switch to Transaction Metadata tab
    const metadataTab = screen.getByRole("button", { name: /Transaction Metadata/i });
    fireEvent.click(metadataTab);
    expect(screen.getByText("Ledger & Settlement Details")).toBeInTheDocument();
    expect(screen.getByText("Soroban Contract Deployments")).toBeInTheDocument();

    // Switch to Approval History tab
    const historyTab = screen.getByRole("button", { name: /Approval History/i });
    fireEvent.click(historyTab);
    expect(screen.getByText("Immutable Lifecycle & Audit Events")).toBeInTheDocument();
  });

  it("handles bundle search filtering", () => {
    render(<ComplianceEvidenceBundleView />);

    const searchInput = screen.getByPlaceholderText(/Search bundle ID, title, txHash.../i);
    fireEvent.change(searchInput, { target: { value: "Multi-Asset" } });

    // Active bundle dropdown should adjust to filtered item
    const select = screen.getByLabelText(/Select active bundle/i) as HTMLSelectElement;
    expect(select.value).toBe("CEB-2026-07-002");
  });

  it("triggers bundle consistency verification", async () => {
    render(<ComplianceEvidenceBundleView />);

    const verifyBtn = screen.getByRole("button", { name: /Verify Consistency/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Verify Consistency/i })).not.toBeDisabled();
    });
  });
});

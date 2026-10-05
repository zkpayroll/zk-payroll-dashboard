import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CapabilityMismatchPanel from "@/components/features/capabilities/CapabilityMismatchPanel";
import WarningBanner from "@/components/ui/WarningBanner";
import { useContractCapabilitiesStore } from "@/stores/contractCapabilities";
import type { ContractCapability, CapabilityMismatchWarning } from "@/stores/contractCapabilities";

const mockCapabilities: ContractCapability[] = [
  {
    id: "cap_zk_proofs",
    name: "ZK Payroll Proofs",
    description: "Zero-knowledge proof generation and verification",
    requiredVersion: ">=2.0.0",
    currentVersion: "1.8.3",
    status: "deprecated",
    mismatchSeverity: "warning",
    lastChecked: "2025-08-22T10:00:00Z",
  },
  {
    id: "cap_batch",
    name: "Batch Processing",
    description: "Batch payroll transaction processing",
    requiredVersion: ">=1.5.0",
    currentVersion: "2.1.0",
    status: "supported",
    mismatchSeverity: null,
    lastChecked: "2025-08-22T10:00:00Z",
  },
  {
    id: "cap_multi",
    name: "Multi-Asset Support",
    description: "Multiple token types in payroll",
    requiredVersion: ">=3.0.0",
    currentVersion: null,
    status: "unsupported",
    mismatchSeverity: "critical",
    lastChecked: "2025-08-22T10:00:00Z",
  },
];

const mockWarnings: CapabilityMismatchWarning[] = [
  {
    id: "warn_1",
    capabilityId: "cap_zk_proofs",
    capabilityName: "ZK Payroll Proofs",
    severity: "warning",
    message: "ZK Payroll Proofs is deprecated",
    details: "Required: >=2.0.0, Current: 1.8.3. Consider upgrading.",
    createdAt: "2025-08-22T10:00:00Z",
    dismissed: false,
  },
  {
    id: "warn_2",
    capabilityId: "cap_multi",
    capabilityName: "Multi-Asset Support",
    severity: "critical",
    message: "Multi-Asset Support is not supported",
    details: "Required: >=3.0.0, Current: unknown. This capability is required.",
    createdAt: "2025-08-22T10:00:00Z",
    dismissed: false,
  },
];

describe("CapabilityMismatchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useContractCapabilitiesStore.setState({
      capabilities: mockCapabilities,
      warnings: mockWarnings,
      lastScanAt: "2025-08-22T10:00:00Z",
      scanning: false,
      contractAddress: "GA...EXAMPLE",
    });
  });

  it("renders the heading and description", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Contract Capabilities")).toBeInTheDocument();
    expect(screen.getByText(/Monitor contract capability mismatches/)).toBeInTheDocument();
  });

  it("shows blocking mismatch alert when unsupported capabilities exist", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Blocking capability mismatch detected")).toBeInTheDocument();
  });

  it("displays active warnings with correct count", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Active Warnings (2)")).toBeInTheDocument();
    expect(screen.getByText("ZK Payroll Proofs is deprecated")).toBeInTheDocument();
    expect(screen.getByText("Multi-Asset Support is not supported")).toBeInTheDocument();
  });

  it("dismisses a warning when dismiss button is clicked", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Active Warnings (2)")).toBeInTheDocument();
    const dismissButtons = screen.getAllByTitle("Dismiss");
    fireEvent.click(dismissButtons[0]);
    expect(screen.getByText("Active Warnings (1)")).toBeInTheDocument();
  });

  it("dismisses all warnings", () => {
    const dismissAllSpy = vi.spyOn(useContractCapabilitiesStore.getState(), "dismissAllWarnings");
    render(<CapabilityMismatchPanel />);
    fireEvent.click(screen.getByText("Dismiss all"));
    expect(dismissAllSpy).toHaveBeenCalled();
  });

  it("lists all capabilities with status labels", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("ZK Payroll Proofs")).toBeInTheDocument();
    expect(screen.getByText("Batch Processing")).toBeInTheDocument();
    expect(screen.getByText("Multi-Asset Support")).toBeInTheDocument();
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(screen.getByText("Unsupported")).toBeInTheDocument();
  });

  it("shows capability count", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Capabilities (3)")).toBeInTheDocument();
  });

  it("expands capability details on click", () => {
    render(<CapabilityMismatchPanel />);
    const capabilityButtons = screen.getAllByText("ZK Payroll Proofs");
    fireEvent.click(capabilityButtons[0]);
    expect(screen.getByText("Zero-knowledge proof generation and verification")).toBeInTheDocument();
  });

  it("shows last scanned timestamp", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText(/Last scanned/)).toBeInTheDocument();
  });

  it("renders Scan Contract button", () => {
    render(<CapabilityMismatchPanel />);
    expect(screen.getByText("Scan Contract")).toBeInTheDocument();
  });
});

describe("WarningBanner", () => {
  it("renders with warning severity", () => {
    render(
      <WarningBanner
        severity="warning"
        title="Test Warning"
        message="This is a test warning message"
      />
    );
    expect(screen.getByText("Test Warning")).toBeInTheDocument();
    expect(screen.getByText("This is a test warning message")).toBeInTheDocument();
  });

  it("renders with critical severity", () => {
    render(
      <WarningBanner
        severity="critical"
        title="Critical Alert"
        message="Something critical happened"
      />
    );
    expect(screen.getByText("Critical Alert")).toBeInTheDocument();
  });

  it("renders with info severity", () => {
    render(
      <WarningBanner
        severity="info"
        title="Info"
        message="Just some info"
      />
    );
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    const onAction = vi.fn();
    render(
      <WarningBanner
        severity="warning"
        title="Warning"
        message="Message"
        actionLabel="Upgrade now"
        onAction={onAction}
      />
    );
    const button = screen.getByText("Upgrade now");
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalled();
  });

  it("renders dismiss button when provided", () => {
    const onDismiss = vi.fn();
    render(
      <WarningBanner
        severity="info"
        title="Info"
        message="Dismissable"
        onDismiss={onDismiss}
      />
    );
    const dismissButton = screen.getByLabelText("Dismiss warning");
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("does not render action button when not provided", () => {
    render(
      <WarningBanner
        severity="warning"
        title="Warning"
        message="No action"
      />
    );
    expect(screen.queryByRole("button", { name: /upgrade/i })).not.toBeInTheDocument();
  });
});

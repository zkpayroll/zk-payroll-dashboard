import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ErrorRemediationDrawer } from "@/components/features/errors/ErrorRemediationDrawer";
import { useErrorRemediationDrawer } from "@/stores/errors";
import type { ErrorRemediation } from "@/types/errors";

const BASE_REMEDIATION: ErrorRemediation = {
  id: "ERR-001",
  category: "treasury",
  title: "Insufficient treasury balance",
  summary: "The payroll contract rejected the disbursement because the treasury balance is lower than the total payroll amount.",
  likelyCause: "The treasury account balance dropped below the required amount after recent employee additions.",
  actions: [
    {
      label: "Check balance",
      description: "Open Treasury and confirm the available balance covers the projected payroll.",
      audience: "contributor",
    },
    {
      label: "Reserve funds",
      description: "Add funds before retrying the submission.",
      audience: "admin",
      href: "/treasury",
    },
    {
      label: "Escalate",
      description: "Notify maintainers if the balance cannot be topped up.",
      audience: "maintainer",
    },
  ],
  docsHref: "https://docs.example.com/treasury",
};

describe("ErrorRemediationDrawer", () => {
  beforeEach(() => {
    useErrorRemediationDrawer.getState().closeRemediation();
  });

  it("does not render when closed", () => {
    render(<ErrorRemediationDrawer />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when opened with a remediation", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Insufficient treasury balance")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close error remediation drawer/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the error category badge", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    expect(screen.getByText("treasury")).toBeInTheDocument();
    expect(screen.getByText("ERR-001")).toBeInTheDocument();
  });

  it("renders the likely cause", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    expect(screen.getByText("The treasury account balance dropped below the required amount after recent employee additions.")).toBeInTheDocument();
  });

  it("renders next actions separated by audience", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    expect(screen.getByText("Contributor")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Maintainer")).toBeInTheDocument();
    expect(screen.getByText(/Check balance:/)).toBeInTheDocument();
    expect(screen.getByText(/Reserve funds:/)).toBeInTheDocument();
    expect(screen.getByText(/Escalate:/)).toBeInTheDocument();
  });

  it("renders action links when href is provided", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    const link = screen.getByRole("link", { name: /Add funds before retrying the submission/i });
    expect(link).toHaveAttribute("href", "/treasury");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders the documentation link when provided", () => {
    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(BASE_REMEDIATION));
    const docsLink = screen.getByRole("link", { name: /view documentation/i });
    expect(docsLink).toHaveAttribute("href", "https://docs.example.com/treasury");
  });

  it("renders a safe unknown error without alarming language", () => {
    const unknownRemediation: ErrorRemediation = {
      id: "ERR-UNKNOWN",
      category: "unknown",
      title: "Unrecognized contract error",
      summary: "This error was not recognized as a known payroll contract failure.",
      likelyCause: "The error message does not match any known pattern.",
      actions: [
        {
          label: "Retry",
          description: "Retry the action once — transient issues can surface as generic failures.",
          audience: "contributor",
        },
        {
          label: "Escalate",
          description: "Capture the run ID and escalate to a maintainer if the issue persists.",
          audience: "maintainer",
        },
      ],
    };

    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(unknownRemediation));
    expect(screen.getByText("Unrecognized contract error")).toBeInTheDocument();
    expect(screen.getByText(/no sensitive transaction data is shown/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry the action once/)).toBeInTheDocument();
    expect(screen.getByText(/Escalate/)).toBeInTheDocument();
  });

  it("renders authorization error with correct audience actions", () => {
    const authRemediation: ErrorRemediation = {
      id: "ERR-AUTH",
      category: "authorization",
      title: "Unauthorized signer",
      summary: "The connected wallet is not authorized to perform this contract call.",
      likelyCause: "The connected wallet address is not in the authorized operators list.",
      actions: [
        {
          label: "Verify wallet",
          description: "Confirm the connected wallet matches an admin or operator account.",
          audience: "contributor",
        },
        {
          label: "Grant role",
          description: "Ask an admin to grant the required role.",
          audience: "admin",
          href: "/admin/roles",
        },
      ],
    };

    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(authRemediation));
    expect(screen.getByText("Unauthorized signer")).toBeInTheDocument();
    expect(screen.getByText("authorization")).toBeInTheDocument();
    expect(screen.getByText(/verify wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/grant role/i)).toBeInTheDocument();
  });

  it("renders proof error with correct category", () => {
    const proofRemediation: ErrorRemediation = {
      id: "ERR-PROOF",
      category: "proof",
      title: "Invalid or expired proof",
      summary: "The zero-knowledge proof attached to this operation failed verification or has expired.",
      likelyCause: "The proof was generated against an outdated commitment set.",
      actions: [
        {
          label: "Check proof status",
          description: "Check the proof freshness badge on the payroll run.",
          audience: "contributor",
        },
        {
          label: "Regenerate proof",
          description: "Generate a new proof from the Execute Payroll wizard.",
          audience: "contributor",
        },
      ],
    };

    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(proofRemediation));
    expect(screen.getByText("Invalid or expired proof")).toBeInTheDocument();
    expect(screen.getByText("proof")).toBeInTheDocument();
    expect(screen.getByText(/check proof status/i)).toBeInTheDocument();
  });

  it("renders conflict error with correct category", () => {
    const conflictRemediation: ErrorRemediation = {
      id: "ERR-CONFLICT",
      category: "conflict",
      title: "Payroll already executed",
      summary: "This payroll run has already been submitted and cannot be executed again.",
      likelyCause: "A previous execution of this payroll run is still pending or confirmed on-chain.",
      actions: [
        {
          label: "Check history",
          description: "Check the payroll run history for the existing transaction.",
          audience: "contributor",
        },
      ],
    };

    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(conflictRemediation));
    expect(screen.getByText("Payroll already executed")).toBeInTheDocument();
    expect(screen.getByText("conflict")).toBeInTheDocument();
  });

  it("renders network error with correct category", () => {
    const networkRemediation: ErrorRemediation = {
      id: "ERR-NETWORK",
      category: "network",
      title: "RPC timeout",
      summary: "The Soroban RPC node did not respond within the timeout window.",
      likelyCause: "The RPC endpoint is congested or temporarily unavailable.",
      actions: [
        {
          label: "Wait and retry",
          description: "Wait 30 seconds and retry the operation.",
          audience: "contributor",
        },
        {
          label: "Switch endpoint",
          description: "Contact maintainers to switch to a healthy RPC endpoint.",
          audience: "maintainer",
        },
      ],
    };

    render(<ErrorRemediationDrawer />);
    act(() => useErrorRemediationDrawer.getState().openRemediation(networkRemediation));
    expect(screen.getByText("RPC timeout")).toBeInTheDocument();
    expect(screen.getByText("network")).toBeInTheDocument();
    expect(screen.getByText(/wait and retry/i)).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenTransferStatusAlert } from "@/components/features/treasury/TokenTransferStatusAlert";
import TreasuryView from "@/components/features/treasury/TreasuryView";

describe("token transfer status guidance", () => {
  it("does not show an error for a confirmed transfer or absent outcome", () => {
    const { rerender } = render(<TokenTransferStatusAlert outcome={{ status: "confirmed" }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<TokenTransferStatusAlert />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["insufficient_balance", /fund the treasury/i],
    ["destination_rejected", /destination and its token permissions/i],
    ["asset_unavailable", /token is supported/i],
    ["wallet_rejected", /review the request in your wallet/i],
  ])("shows actionable guidance for %s without encouraging blind retry", (reason, expected) => {
    render(<TokenTransferStatusAlert outcome={{ status: "failed", reason }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Token transfer failed");
    expect(alert).toHaveTextContent(expected);
    expect(alert).toHaveTextContent(/check the transaction status before retrying/i);
  });

  it("shows unknown status without claiming failure or instructing immediate retry", () => {
    render(<TokenTransferStatusAlert outcome={{ status: "unknown" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/status is unknown/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/transfer failed/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/check the transaction status before retrying/i);
  });

  it.each(["constructor", "__proto__", "salary $9000 employee Jane GSECRET"]) (
    "uses generic guidance without exposing untrusted reason %s", (reason) => {
      render(<TokenTransferStatusAlert outcome={{ status: "failed", reason }} />);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/review the transfer details privately/i);
      expect(alert).not.toHaveTextContent(reason);
    },
  );

  it("displays a supplied failure in the treasury view", () => {
    render(<TreasuryView tokenTransferOutcome={{ status: "failed", reason: "wallet_rejected" }} />);
    expect(screen.getByTestId("token-transfer-status")).toHaveTextContent(/review the request in your wallet/i);
  });
});

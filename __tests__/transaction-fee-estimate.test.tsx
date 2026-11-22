import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TransactionFeeEstimate from "@/components/features/payroll/TransactionFeeEstimate";
import { useEnvironmentStore } from "@/stores/environment";

describe("TransactionFeeEstimate", () => {
  afterEach(() => {
    useEnvironmentStore.getState().reset();
  });

  it("shows the active environment passphrase before signing", () => {
    useEnvironmentStore.setState({
      activeProfile: "custom",
      customProfile: {
        horizonUrl: "https://horizon.example.com",
        sorobanRpcUrl: "https://rpc.example.com",
        networkPassphrase: "Custom Payroll Network ; November 2026",
        stellarNetwork: "TESTNET",
      },
    });

    render(<TransactionFeeEstimate totalAmount={1000} employeeCount={2} />);

    expect(screen.getByText("Network passphrase for signing")).toBeInTheDocument();
    expect(screen.getByTestId("network-passphrase")).toHaveTextContent(
      "Custom Payroll Network ; November 2026",
    );
  });
});

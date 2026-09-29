import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionConfirmationNonceStatus } from "@/components/features/payroll/ExecutionConfirmationNonceStatus";

describe("execution confirmation nonce status", () => {
  it("shows a known ledger nonce and confirmed state", () => {
    render(<ExecutionConfirmationNonceStatus status="confirmed" nonce="1842" />);

    expect(screen.getByText("Ledger confirmation received")).toBeInTheDocument();
    expect(screen.getByText("Ledger nonce: 1842")).toBeInTheDocument();
  });

  it("explains when confirmation metadata is unavailable", () => {
    render(<ExecutionConfirmationNonceStatus status="unavailable" />);

    expect(screen.getByText("Confirmation status unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Nonce unavailable/)).toBeInTheDocument();
  });
});

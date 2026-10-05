import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import SigningFailureRecoveryCenter from "@/components/features/wallet/SigningFailureRecoveryCenter";
import { useSigningFailuresStore } from "@/stores/signingFailures";

describe("useSigningFailuresStore", () => {
  beforeEach(() => {
    useSigningFailuresStore.setState({ failures: [] });
  });

  it("records a failure and returns its id", () => {
    const id = useSigningFailuresStore
      .getState()
      .recordFailure({ category: "rejected", message: "User declined" });
    expect(typeof id).toBe("string");
    expect(useSigningFailuresStore.getState().failures).toHaveLength(1);
    expect(useSigningFailuresStore.getState().failures[0].resolved).toBe(false);
  });

  it("resolves a failure without removing it", () => {
    const id = useSigningFailuresStore
      .getState()
      .recordFailure({ category: "expired-session", message: "Wallet locked" });
    useSigningFailuresStore.getState().resolveFailure(id);
    const failure = useSigningFailuresStore.getState().failures.find((f) => f.id === id);
    expect(failure?.resolved).toBe(true);
  });

  it("dismisses a failure by removing it", () => {
    const id = useSigningFailuresStore
      .getState()
      .recordFailure({ category: "malformed-transaction", message: "Invalid XDR" });
    useSigningFailuresStore.getState().dismissFailure(id);
    expect(useSigningFailuresStore.getState().failures).toHaveLength(0);
  });

  it("clears all failures", () => {
    useSigningFailuresStore.getState().recordFailure({ category: "rejected", message: "a" });
    useSigningFailuresStore.getState().recordFailure({ category: "unknown", message: "b" });
    useSigningFailuresStore.getState().clearAll();
    expect(useSigningFailuresStore.getState().failures).toHaveLength(0);
  });
});

describe("SigningFailureRecoveryCenter", () => {
  beforeEach(() => {
    useSigningFailuresStore.setState({ failures: [] });
  });

  it("shows an empty state when there are no unresolved failures", () => {
    render(<SigningFailureRecoveryCenter />);
    expect(screen.getByText("Wallet signing recovery center")).toBeInTheDocument();
    expect(screen.getByText(/No unresolved signing failures/)).toBeInTheDocument();
  });

  it("groups failures by category with recovery guidance", () => {
    useSigningFailuresStore.getState().recordFailure({
      category: "rejected",
      message: "User declined to sign",
    });
    useSigningFailuresStore.getState().recordFailure({
      category: "expired-session",
      message: "Wallet is locked",
    });

    render(<SigningFailureRecoveryCenter />);

    expect(screen.getByText("Transaction rejected")).toBeInTheDocument();
    expect(screen.getByText("Session expired")).toBeInTheDocument();
    expect(screen.getByText("User declined to sign")).toBeInTheDocument();
    expect(screen.getByText("Wallet is locked")).toBeInTheDocument();
  });

  it("marking a failure as retried resolves and removes it from the list", () => {
    useSigningFailuresStore.getState().recordFailure({
      category: "rejected",
      message: "User declined to sign",
    });
    render(<SigningFailureRecoveryCenter />);
    fireEvent.click(screen.getByText("Mark retried"));
    expect(screen.queryByText("User declined to sign")).not.toBeInTheDocument();
    expect(screen.getByText(/No unresolved signing failures/)).toBeInTheDocument();
  });

  it("dismissing a failure removes it entirely from the store", () => {
    useSigningFailuresStore.getState().recordFailure({
      category: "malformed-transaction",
      message: "Invalid XDR",
    });
    render(<SigningFailureRecoveryCenter />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(useSigningFailuresStore.getState().failures).toHaveLength(0);
  });
});

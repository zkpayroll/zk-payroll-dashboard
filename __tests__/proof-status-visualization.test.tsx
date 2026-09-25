import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useProofStatusStore,
  formatSafeFailureReason,
  SAFE_STATUS_EXPLANATIONS,
  type ProofLifecycleState,
} from "@/stores/proofStatus";
import { ProofLifecycleTimeline } from "@/components/features/proofs/ProofLifecycleTimeline";
import { ProofStatusCard } from "@/components/features/proofs/ProofStatusCard";
import MultiAssetPayrollReview from "@/components/features/payroll/MultiAssetPayrollReview";
import type { MultiAssetPayrollRun } from "@/types/models";

const ALL_STATES: ProofLifecycleState[] = [
  "queued",
  "generating",
  "ready",
  "submitted",
  "verified",
  "failed",
  "expired",
];

const mockRun: MultiAssetPayrollRun = {
  id: "run-99",
  companyId: "comp-1",
  label: "Monthly Payroll US & EU",
  createdAt: "2026-08-26T00:00:00Z",
  status: "ready",
  totalEmployees: 2,
  proofStatus: "ready",
  assetGroups: [
    {
      asset: { code: "USDC" },
      employees: [
        {
          employeeId: "emp-1",
          name: "Alice",
          address: "GABC...1234",
          amount: 5000,
          salaryCommitment: "commit-1",
        },
      ],
      totalAmount: 5000,
      transactionCount: 1,
      status: "funded",
      treasuryReadiness: {
        asset: { code: "USDC" },
        requiredAmount: 5000,
        availableBalance: 10000,
        isFunded: true,
        shortfall: 0,
      },
    },
  ],
};

describe("Proof Status Visualization & Lifecycle State Machine", () => {
  beforeEach(() => {
    act(() => {
      useProofStatusStore.getState().reset();
    });
  });

  describe("Lifecycle State Coverage & Explanations", () => {
    it.each(ALL_STATES)("renders the card correctly for lifecycle state: %s", (status) => {
      act(() => {
        const store = useProofStatusStore.getState();
        if (status === "queued") store.queueProof("run-101");
        else if (status === "generating") {
          store.queueProof("run-101");
          store.startGenerating();
          store.setProgress(45);
        } else if (status === "ready") store.setReady("proof-abc-123");
        else if (status === "submitted") store.markSubmitted("0x123abc...");
        else if (status === "verified") store.markVerified("2026-08-26T10:00:00Z");
        else if (status === "failed") store.setFailed("WASM circuit constraint error", "Retry generation");
        else if (status === "expired") store.markExpired();
      });

      render(<ProofStatusCard />);

      const card = screen.getByTestId("proof-status-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("data-proof-status", status);

      const badge = screen.getByTestId(`proof-status-badge-${status}`);
      expect(badge).toBeInTheDocument();

      const explanation = SAFE_STATUS_EXPLANATIONS[status](useProofStatusStore.getState());
      const elements = screen.getAllByText(explanation.title);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("renders progress bar and numeric percentage during generating state", () => {
      act(() => {
        useProofStatusStore.getState().startGenerating();
        useProofStatusStore.getState().setProgress(65);
      });

      render(<ProofStatusCard />);

      expect(screen.getByTestId("proof-generation-progress")).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("displays next-step guidance for failed and expired states", () => {
      act(() => {
        useProofStatusStore.getState().setFailed("Internal error", "Check treasury balance and re-attempt.");
      });

      render(<ProofStatusCard />);

      const guidance = screen.getByTestId("next-step-guidance");
      expect(guidance).toBeInTheDocument();
      expect(guidance).toHaveTextContent("Check treasury balance and re-attempt.");
      expect(screen.getByTestId("regenerate-proof-button")).toBeInTheDocument();
    });
  });

  describe("Safe Failure Message Redaction & Privacy", () => {
    it("redacts raw SSNs, private keys, and stack trace internals from failure messages", () => {
      const rawError =
        "RuntimeError: unreachable at async proofGen (wasm:0x1a8f9) ssn: 123-45-6789 privateKey: SA1234567890ABCDEF";
      const safeReason = formatSafeFailureReason(rawError);

      expect(safeReason).not.toContain("123-45-6789");
      expect(safeReason).not.toContain("SA1234567890ABCDEF");
      expect(safeReason).not.toContain("at async proofGen");
      expect(safeReason).toContain("Circuit constraint unsatisfied");
    });

    it("never renders raw salary amounts or SSNs in DOM nodes of ProofStatusCard", () => {
      act(() => {
        useProofStatusStore.getState().setFailed("Failed for salary: $150,000 SSN: 999-99-9999");
      });

      render(<ProofStatusCard />);

      const domContent = screen.getByTestId("proof-status-card").innerHTML;
      expect(domContent).not.toContain("999-99-9999");
      expect(domContent).not.toContain("$150,000");
    });
  });

  describe("Execution Readiness & Actions", () => {
    it("sets executionReady to true ONLY when proof status is ready", () => {
      const store = useProofStatusStore.getState();

      store.queueProof("p1");
      expect(useProofStatusStore.getState().executionReady).toBe(false);

      store.startGenerating();
      expect(useProofStatusStore.getState().executionReady).toBe(false);

      store.setReady("proof-1");
      expect(useProofStatusStore.getState().executionReady).toBe(true);

      store.markSubmitted("tx-1");
      expect(useProofStatusStore.getState().executionReady).toBe(false);

      store.markExpired();
      expect(useProofStatusStore.getState().executionReady).toBe(false);
    });

    it("triggers regenerate action when regenerate button is clicked on expired proof", () => {
      const onRegenerate = vi.fn();
      act(() => {
        useProofStatusStore.getState().markExpired();
      });

      render(<ProofStatusCard onRegenerateProof={onRegenerate} />);

      const btn = screen.getByTestId("regenerate-proof-button");
      fireEvent.click(btn);
      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Payroll Review Integration", () => {
    it("integrates ProofStatusCard into MultiAssetPayrollReview and controls submit button", () => {
      const handleSubmit = vi.fn();
      render(<MultiAssetPayrollReview run={mockRun} onSubmit={handleSubmit} />);

      expect(screen.getByTestId("proof-status-card")).toBeInTheDocument();

      const submitBtn = screen.getByRole("button", { name: /Submit payroll run/i });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it("disables submit button when proofStatus is not ready", () => {
      const unreadyRun: MultiAssetPayrollRun = {
        ...mockRun,
        proofStatus: "generating",
      };

      render(<MultiAssetPayrollReview run={unreadyRun} onSubmit={vi.fn()} />);

      const submitBtn = screen.getByRole("button", { name: /Submit payroll run/i });
      expect(submitBtn).toBeDisabled();
    });
  });
});

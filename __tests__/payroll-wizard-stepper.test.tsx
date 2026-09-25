import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PayrollWizard from "@/components/features/payroll/PayrollWizard";
import { usePayrollWizardStore } from "@/stores/payrollWizard";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock wallet store to ensure we are connected and on the correct network
const walletState = { network: "TESTNET", isConnected: true, publicKey: "GTEST123" };
vi.mock("@/stores/walletStore", () => ({
  useWalletStore: Object.assign(
    (fn?: any) => (fn ? fn(walletState) : walletState),
    {
      getState: () => walletState,
      setState: vi.fn(),
    }
  ),
}));

// Mock StellarProvider to avoid EXPECTED_NETWORK reference errors
vi.mock("@/components/providers/StellarProvider", () => ({
  EXPECTED_NETWORK: "TESTNET",
  useStellar: () => ({
    publicKey: "GTEST123",
  }),
}));

/**
 * Issue #295: the submission progress stepper renders alongside the wizard's
 * existing step nav without breaking the established flow.
 */
describe("PayrollWizard submission progress stepper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    usePayrollWizardStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the stepper nav alongside the wizard at the start state", () => {
    render(<PayrollWizard />);

    expect(
      screen.getByRole("navigation", { name: /payroll submission progress/i }),
    ).toBeInTheDocument();
    // All six lifecycle stages are visible from the start.
    expect(screen.getByTestId("stage-validation")).toBeInTheDocument();
    expect(screen.getByTestId("stage-approval")).toBeInTheDocument();
    expect(screen.getByTestId("stage-signing")).toBeInTheDocument();
    expect(screen.getByTestId("stage-submission")).toBeInTheDocument();
    expect(screen.getByTestId("stage-confirmation")).toBeInTheDocument();
    expect(screen.getByTestId("stage-reconciliation")).toBeInTheDocument();
    // Validation is the active stage before the run starts.
    expect(screen.getByTestId("stage-validation")).toHaveAttribute(
      "data-state",
      "active",
    );
    // The existing wizard nav still renders.
    expect(
      screen.getByRole("navigation", { name: /payroll execution progress/i }),
    ).toBeInTheDocument();
  });

  it("advances the stepper as the wizard progresses through steps", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(<PayrollWizard />);

    fireEvent.click(screen.getByRole("button", { name: /start payroll run/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    // Proof step: validation still active.
    expect(screen.getByTestId("stage-validation")).toHaveAttribute(
      "data-state",
      "active",
    );

    fireEvent.click(screen.getByRole("button", { name: /generate proof/i }));
    await vi.advanceTimersByTimeAsync(2000);

    // After proof success the wizard is on the confirm step: validation
    // complete, approval active.
    expect(screen.getByTestId("stage-validation")).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(screen.getByTestId("stage-approval")).toHaveAttribute(
      "data-state",
      "active",
    );

    randomSpy.mockRestore();
  });

  it("marks submission as failed in the stepper when submission errors", async () => {
    // Seed the store directly at the confirm step with valid employees and a
    // successful proof so submission is unblocked (the built-in "Start Payroll
    // Run" flow selects all mock employees, including an inactive one, which
    // intentionally blocks submission — that guard is covered elsewhere).
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
      proofError: null,
      submissionStatus: "idle",
      submissionError: null,
    });
    // Force the submission failure path.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

    render(<PayrollWizard />);

    const checkbox = screen.getByLabelText(
      /Confirm Payroll Execution Summary/i,
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /submit payroll/i }));

    // Submission fails after its 1500ms delay.
    await vi.advanceTimersByTimeAsync(1500);

    expect(usePayrollWizardStore.getState().submissionStatus).toBe("error");
    expect(screen.getByTestId("stage-validation")).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(screen.getByTestId("stage-signing")).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(screen.getByTestId("stage-submission")).toHaveAttribute(
      "data-state",
      "failed",
    );

    randomSpy.mockRestore();
  });
});

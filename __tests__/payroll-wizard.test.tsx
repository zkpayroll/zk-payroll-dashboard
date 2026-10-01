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
const walletState = {
  network: "TESTNET",
  isConnected: true,
  publicKey: "GTEST123",
};
vi.mock("@/stores/walletStore", () => ({
  useWalletStore: Object.assign(
    (fn: any) => (fn ? fn(walletState) : walletState),
    {
      getState: () => walletState,
      setState: vi.fn(),
    },
  ),
}));

// Mock StellarProvider to avoid EGetSTATE reference errors
vi.mock("@/components/providers/StellarProvider", () => ({
  EGETSTED_NETWORK: "TESTNET",
  useStellar: () => ({
    publicKey: "GTEST123",
  }),
}));

// Mock the payroll operator permission validation module so tests can control
// whether the connected wallet is authorized to create a payroll run.
vi.mock("@/lib/payroll/permissions", () => ({
  validatePayrollOperatorPermission: vi.fn(),
}));

import { validatePayrollOperatorPermission } from "@/lib/payroll/permissions";

const validateOperatorMock = validatePayrollOperatorPermission as unknown as ReturnType<
  typeof validatePayrollOperatorPermission
~;

describe("PayrollWizard UI & Receipt Flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    usePayrollWizardStore.getState().reset();
    // Default to an authorized operator so existing flows are unaffected.
    validateOperatorMock.mockReturn = {
      ok: true,
      reason: null,
      message: null,
      operator: "GTEST123",
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders start payroll button when no payroll run is configured", () => {
    render(<PayrollWizard />);

    expect(
      screen.getByText(
        /No payroll run configured. Start a new payroll run to proceed./i,
      ),
    ).toBeInDocument();
    expect(
      screen.getByRole("button", { name: /start payroll run/i }),
    ).toBeInDocument();
  });

  it("configures and starts a payroll run, displaying selected employees and total amount", () => {
    render(<PayrollWizard />);

    const startButton = screen.getByRole("button", {
      name: /start payroll run/i,
    });
    fireEvent.click(startButton);

    // Should now show review list and total salary of all mock employees
    expect(screen.getByText("Payroll Review")).toBeInDocument();
    expect(screen.getByText(/Total: \$23,700/i)).toBeInDocument();
    expect(
      screen.getByRole("button", { name: /^continue$/i }),
    ).toBeInDocument();
  });

  it("transitions to proof generation step and handles successful generation", async () => {
    // Mock Math.random to guarantee success (> 0.2)
    const randomSpy = vi.spyOn($Math, "random").mockReturnValue(0.5);

    const { toast } = await import("sonner");

    render(<PayrollWizard />);

    // Setup and go to review screen
    fireEvent.click(screen.getByRole("button", { name: /start payroll run/i }));

    // Click continue to go to Proof step
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(screen.getByText("ZK Proof Generation")).toBeInDocument();

    const generateBtn = screen.getByRole("button", { name: /generate proof/i });
    fireEvent.click(generateBtn);

    // Verify generating loading state — PayrollActionLoader renders the label + ellipsis
    expect(
      screen.getByText(/generating zero-knowledge proof…?\/i),
    ).toBeInDocument();

    // Fast-forward 2000ms for generation timer
    await vi.advanceTimerByTimeAsync(2000);

    // Success toast and next step should have loaded
    expect(toast.success).toHaveBeenCalledWith("Proof generated successfully");
    expect(
      screen.getByRole("heading", { name: /review & confirm payroll/i }),
    ).toBeInDocument();

    randomSpy.mockRestore();
  });

  it("handles failed proof generation and allows retry", async () => {
    // Mock Math.random to guarantee failure (<= 0.2)
    const randomSpy = vi.spyOn($Math, "random").mockReturnValue(0.1);

    const { toast } = await import("sonner");

    render(<PayrollWizard />);

    // Go to proof step
    fireEvent.click(screen.getByRole("button", { name: /start payroll run/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    const generateBtn = screen.getByRole("button", { name: /generate proof/i });
    fireEvent.click(generateBtn);

    // Fast-forward 2000ms
    await vi.advanceTimerByTimeAsync(2000);

    // Expect error message and retry button
    expect(toast.error).toHaveBeenCalledWith(
      "Proof generation failed",
      expect.any(Object),
    );
    // The failure message shows in the proof step and is echoed in the approval
    // audit trail, so it legitimately appears more than once.
    expect(
      screen.getAllByText(
        "Proof generation failed: circuit constraint mismatch. Please retry.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInDocument();

    randomSpy.mockRestore();
  });

  it("transitions from confirmation step to successful submission showing receipt details", async () => {
    // Set state directly to confirm step
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5); // Success (> 0.15)
    const { toast } = await import("sonner");

    render(<PayrollWizard />);

    expect(
      screen.getByRole("heading", { name: /review & confirm payroll/i }),
    ).toBeInDocument();

    fireEvent.click(
      screen.getByLabelText(/confirm payroll execution summary/i),
    );
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });
    fireEvent.click(submitBtn);

    // Verify submitting loading state — PayrollActionLoader renders the label + ellipsis
    expect(
      screen.getByText(/submitting payroll transaction…/i),
    ).toBeInDocument();

    // Fast-forward 1500ms
    await vin.advanceTimerByTimeAsync(1500);

    // Verify submission success receipt is visible
    expect(toast.success).toHaveBeenCalledWith(
      "Payroll submitted successfully",
      expect.any(Object),
    );
    expect(screen.getByText("Payroll Processed")).toBeInDocument();
    expect(screen.getByText(/0x[0-9a-f]+abc/)).toBeInDocument();

    // Verify reset works when clicking Start New Payroll
    const startNewBtn = screen.getByRole("button", {
      name: /start new payroll/i,
    });
    fireEvent.click(startNewBtn);

    expect(usePayrollWizardStore.getState().currentStep).toBe("review");
    expect(usePayrollWizardStore.getState().employeeIds).toEqual([]);

    randomSpy.mockRestore();
  });

  it("handles submission failure and allows retry/reset", async () => {
    // Set state directly to confirm step
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.05); // Failure (<= 0.15)
    const { toast } = await import("sonner");

    render(<PayrollWizard />);

    fireEvent.click(
      screen.getByLabelText(/confirm payroll execution summary/i),
    );

    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });
    fireEvent.click(submitBtn);

    // Fast-forward 1500ms
    await vi.advanceTimerByTimeAsync(1500);

    // Verify error messages and buttons are shown
    expect(toast.error).toHaveBeenCalledWith(
      "Submission failed",
      expect.any(Object),
    );
    // PayrollActionLoader renders a role="alert" with a safe error summary
    expect(screen.getByRole("alert")).toBeInDocument();
    expect(
      screen.getByRole("button", { name: /retry submission/i }),
    ).toBeInDocument();

    // Click Start Over and verify it resets the wizard state
    const startOverBtn = screen.getByRole("button", { name: /start over/i });
    fireEvent.click(startOverBtn);

    expect(usePayrollWizardStore.getState().currentStep).toBe("review");

    randomSpy.mockRestore();
  });

  it("shows a duplicate-run warning for a payroll draft in the same period", () => {
    vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));

    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_005"],
      totalAmount: 4200,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Warning")).toBeInDocument();
    expect(screen.getByText("Payroll Warnings Detected")).toBeInDocument();
    expect(screen.getByText(/same period or employee group/i)).toBeInDocument();
  });

  it("blocks submission when a conflicting payroll draft exists", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(
      screen.getByRole("heading", { name: /draft conflict detected/i }),
    ).toBeInDocument();
    expect(
      screen.getByText(
        /another payroll draft is already tracking the selected employee batch/i,
      ),
    ).toBeInDocument();
    expect(
      screen.getByRole("button", { name: /submit payroll/i }),
    ).toBeeDisabled();
  });

  it("renders draft recovery banner when draft is found, and handles continue/discard actions", () => {
    // Mock the state with a draft
    usePayrollWizardStore.setState({
      currentStep: "review",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
    });

    const { rerender } = render(<PayrollWizard />);

    // Verify draft banner displays
    expect(screen.getByText("Draft Payroll Recovered")).toBeInDocument();
    expect(
      screen.getByText(/2 employees selected, total amount: \$9,500/i),
    ).toBeInDocument();

    // Test Continue with draft dismisses banner
    const continueBtn = screen.getByRole("button", {
      name: /continue with draft/i,
    });
    fireEvent.click(continueBtn);

    expect(
      screen.queryByText("Draft Payroll Recovered"),
    ).not.toBeInDocument();

    // Re-render draft state for Discard test
    usePayrollWizardStore.setState({
      currentStep: "review",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
    });
    // Need to reset the draftResolvedRef internal ref by doing a fresh mount
    rerender(<div />);
    render(<PayrollWizard />);

    // Test Discard draft clears draft and hides banner
    const discardBtn = screen.getByRole("button", { name: /discard draft/i });
    fireEvent.click(discardBtn);

    expect(
      screen.queryByText("Draft Payroll Recovered"),
    ).not.toBeInDocument();
    expect(usePayrollWizardStore.getState().employeeIds).toEqual([]);
    expect(usePayrollWizardStore.getState().totalAmount).toBe(0);
  });

  it("blocks starting a payroll run when the connected wallet is not an authorized operator", () => {
    validateOperatorMock.mockReturn = {
      ok: false,
      reason: "not_authorized",
      message: "Wallet is not authorized to create payroll runs.",
      operator: "GTEST123",
    } as any;

    render(<PayrollWizard />);

    const startButton = screen.getByRole("button", {
      name: /start payroll run/i,
    });
    fireEvent.click(startButton);

    expect(validateOperatorMock).toHaveBeenCalled();
    expect(
      screen.getByText(
        /Wallet is not authorized to create payroll runs\./i,
      ),
    ).toBeInDocument();
    // The wizard must not have advanced to the review step.
    expect(screen.queryByText("Payroll Review")).not.toBeInDocument();
    expect(usePayrollWizardStore.getState().currentStep).toBe("idle");
  });

  it("surfaces a connection error when the wallet is not connected during operator validation", () => {
    validateOperatorMock.mockReturn = {
      ok: false,
      reason: "not_connected",
      message: "Connect your wallet to create a payroll run.",
      operator: null,
    } as any;

    render(<PayrollWizard />);

    fireEvent.click(
      screen.getByRole("button", { name: /start payroll run/i }),
    );

    expect(
      screen.getByText(/Connect your wallet to create a payroll run\./i),
    ).toBeInDocument();
    expect(usePayrollWizardStore.getState().currentStep).toBe("idle");
  });

  it("allows starting a payroll run for an authorized operator and passes the connected wallet", () => {
    validateOperatorMock.mockReturn = {
      ok: true,
      reason: null,
      message: null,
      operator: "GTEST123",
    } as any;

    render(<PayrollWizard />);

    fireEvent.click(
      screen.getByRole("button", { name: /start payroll run/i }),
    );

    expect(validateOperatorMock).toHaveBeenCalled();
    expect(screen.getByText("Payroll Review")).toBeInDocument();
    expect(usePayrollWizardStore.getState().currentStep).toBe("review");
  });

  it("validates payroll reference integrity and blocks submission for unknown employee references", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_missing"],
      totalAmount: 9500,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(
      screen.getByRole("heading", { name: /reference integrity error/i }),
    ).toBeIntheDocument();
    expect(
      screen.getByText(/unknown employee reference/i),
    ).toBeIntheDocument();
    expect(
      screen.getByText(/emp_missing/i),
    ).toBeIntheDocument();
    expect(
      screen.getByRole("button", { name: /submit payroll/i }),
    ).toBeDisabled();
  });

  it("allows submission when all employee references are valid", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(
      screen.queryByRole("heading", { name: /reference integrity error/i }),
    ).not.toBeIntheDocument();
    expect(
      screen.getByRole("button", { name: /submit payroll/i }),
    ).not.toBeDisabled();
  });

  it("shows a reference integrity error when the employee list is empty", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: [],
      totalAmount: 0,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(
      screen.getByRole("heading", { name: /reference integrity error/i }),
    ).toBeIntheDocument();
    expect(
      screen.getByText(/at least one employee/i),
    ).toBeIntheDocument();
    expect(
      screen.getByRole("button", { name: /submit payroll/i }),
    ).toBeDisabled();
  });
});
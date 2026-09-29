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

// Mock wallet store
vi.mock("@/stores/walletStore", () => ({
  useWalletStore: Object.assign(
    (fn: any) => fn({ network: "TESTNET" }),
    {
      getState: () => ({ network: "TESTNET" }),
      setState: vi.fn(),
    }
  ),
}));

// Mock StellarProvider
vi.mock("@/components/providers/StellarProvider", () => ({
  EXPECTED_NETWORK: "TESTNET",
  useStellar: () => ({
    publicKey: "GTEST123",
  }),
}));

// The demo dataset keeps tx_003 perpetually "pending" for the only two active
// employees (emp_001/emp_002), so draft-conflict detection would always fire and
// make the all-clear "Ready" state unreachable. Draft-conflict behavior is
// covered on its own in payroll-wizard.test.tsx; here we isolate the validation
// flows by dropping in-flight pending runs from the conflict source.
vi.mock("@/lib/api/mockData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/mockData")>();
  return {
    ...actual,
    MOCK_PAYROLL_RUNS: actual.MOCK_PAYROLL_RUNS.filter(
      (run) => run.status !== "pending",
    ),
  };
});

describe("Payroll Confirmation Summary & Validation Flows", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    usePayrollWizardStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Ready Confirmation Flow: displays all success indicators and enables submission on confirmation", async () => {
    const onSubmitMock = vi.fn();

    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
      isProofNearingExpiration: false,
      treasuryBalanceOverride: null,
    });

    render(
      <PayrollWizard />
    );

    // Verify confirmation layout exists
    expect(screen.getByText("Review & Confirm Payroll")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /final review checklist/i })).toBeInTheDocument();
    expect(screen.getByText("Employee records reviewed")).toBeInTheDocument();
    expect(screen.getByText("Treasury balance verified")).toBeInTheDocument();
    expect(screen.getByText("ZK proof verified")).toBeInTheDocument();
    expect(screen.getByText("Payroll conflicts checked")).toBeInTheDocument();
    
    // Status should be Ready
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/All Checks Passed|Payroll Warnings Detected/),
    ).toBeInTheDocument();

    // Checkbox and submit button behaviors
    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
    expect(submitBtn).toBeDisabled();

    // Check the box
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(submitBtn).not.toBeDisabled();

    // Submit
    fireEvent.click(submitBtn);
    expect(usePayrollWizardStore.getState().currentStep).toBe("submit");
  });

  it("Warning Confirmation Flow: handles low treasury buffer warning", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 25000, // safety buffer is 45000 - 25000 = 20000 (which is < 25000 threshold)
      proofStatus: "success",
      isProofNearingExpiration: false,
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Payroll Warnings Detected")).toBeInTheDocument();
    expect(screen.getByText(/approaching the minimum safety buffer threshold/i)).toBeInTheDocument();

    // Should still allow submitting after checking confirmation box
    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(submitBtn).toBeDisabled();
    fireEvent.click(checkbox);
    expect(submitBtn).not.toBeDisabled();
  });

  it("Warning Confirmation Flow: handles proof nearing expiration warning", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "success",
      isProofNearingExpiration: true,
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Payroll Warnings Detected")).toBeInTheDocument();
    expect(screen.getByText(/proof is nearing its expiration/i)).toBeInTheDocument();

    // Allows submission
    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(submitBtn).toBeDisabled();
    fireEvent.click(checkbox);
    expect(submitBtn).not.toBeDisabled();
  });

  it("Blocked Confirmation Flow: handles insufficient treasury funds", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 50000, // balance is 45000, so insufficient
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Submission Blocked")).toBeInTheDocument();
    expect(screen.getByText(/Treasury balance is insufficient/i)).toBeInTheDocument();
    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);

    // Checkbox should be disabled or button remains disabled even after interaction
    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(checkbox).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });

  it("Blocked Confirmation Flow: handles missing/invalid proof status", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"],
      totalAmount: 9500,
      proofStatus: "idle", // proof must be success to be valid
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Submission Blocked")).toBeInTheDocument();
    expect(screen.getByText(/Zero-Knowledge proof is missing or invalid/i)).toBeInTheDocument();

    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(checkbox).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });

  it("Blocked Confirmation Flow: handles inactive employee selection", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_003"], // emp_003 is inactive
      totalAmount: 4800,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Submission Blocked")).toBeInTheDocument();
    expect(screen.getByText(/Payroll contains inactive or invalid employee data/i)).toBeInTheDocument();

    const checkbox = screen.getByLabelText(/Confirm Payroll Execution Summary/i) as HTMLInputElement;
    const submitBtn = screen.getByRole("button", { name: /submit payroll/i });

    expect(checkbox).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });
});

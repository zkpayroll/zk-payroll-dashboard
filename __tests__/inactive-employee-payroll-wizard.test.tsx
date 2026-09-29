import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollWizard from "@/components/features/payroll/PayrollWizard";
import { usePayrollWizardStore } from "@/stores/payrollWizard";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/stores/walletStore", () => ({
  useWalletStore: Object.assign(
    (fn: (state: { network: string }) => unknown) => fn({ network: "TESTNET" }),
    {
      getState: () => ({ network: "TESTNET" }),
      setState: vi.fn(),
    },
  ),
}));

vi.mock("@/components/providers/StellarProvider", () => ({
  EXPECTED_NETWORK: "TESTNET",
  useStellar: () => ({ publicKey: "GTEST123" }),
}));

// The demo roster has no suspended employee, so suspend emp_002 to prove the
// draft check reads lifecycle status and not only the legacy `status` field.
vi.mock("@/lib/api/mockData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/mockData")>();
  return {
    ...actual,
    MOCK_EMPLOYEES: actual.MOCK_EMPLOYEES.map((employee) =>
      employee.id === "emp_002"
        ? { ...employee, lifecycleStatus: "suspended" as const }
        : employee,
    ),
    MOCK_PAYROLL_RUNS: actual.MOCK_PAYROLL_RUNS.filter(
      (run) => run.status !== "pending",
    ),
  };
});

describe("Payroll draft warning for inactive or suspended employees (#293)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    usePayrollWizardStore.getState().clearDraft();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks signing when the draft holds a suspended employee and names them", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001", "emp_002"], // emp_002 is suspended in this mock
      totalAmount: 9500,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(screen.getByText("Submission Blocked")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Payroll contains inactive or invalid employee data: Kwame Asante \(Suspended\)/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit payroll/i }),
    ).toBeDisabled();
  });

  it("leaves a fully active draft unblocked", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_001"],
      totalAmount: 5000,
      proofStatus: "success",
    });

    render(<PayrollWizard />);

    expect(
      screen.queryByText(/Payroll contains inactive or invalid employee data/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Submission Blocked")).not.toBeInTheDocument();
  });

  it("shows the reviewer warning with next steps while reviewing the draft", () => {
    usePayrollWizardStore.setState({
      currentStep: "review",
      employeeIds: ["emp_001", "emp_002", "emp_003"],
      totalAmount: 14300,
    });

    render(<PayrollWizard />);

    expect(screen.getByTestId("inactive-employee-warning")).toBeInTheDocument();
    expect(
      screen.getByTestId("ineligible-employee-emp_002"),
    ).toHaveTextContent("Kwame Asante");
    expect(
      screen.getByTestId("ineligible-employee-emp_003"),
    ).toHaveTextContent("Amara Diallo");
    expect(
      screen.getByTestId("inactive-employee-next-steps"),
    ).toHaveTextContent("employee lifecycle screen");
  });
});

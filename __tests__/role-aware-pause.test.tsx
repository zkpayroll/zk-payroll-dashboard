import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { canPausePayroll, getPauseRestrictionReason } from "@/lib/auth/roles";
import { PausePayrollDialog } from "@/components/features/payroll/PausePayrollDialog";
import { useWalletStore } from "@/stores/walletStore";
import type { PayrollRun } from "@/types/models";

const mockPendingRun: PayrollRun = {
  id: "run_pause_001",
  companyId: "company_001",
  timestamp: "2025-06-01T00:00:00Z",
  proof: "0xproof",
  employeeIds: ["emp_1", "emp_2"],
  status: "pending",
  totalAmount: 32000,
  employeeCount: 2,
  createdAt: "2025-06-01T00:00:00Z",
};

describe("canPausePayroll permission helpers (Issue #665)", () => {
  it("allows only the admin role to pause/resume payroll runs", () => {
    expect(canPausePayroll("admin")).toBe(true);
    expect(canPausePayroll("operator")).toBe(false);
    expect(canPausePayroll("auditor")).toBe(false);
  });

  it("gives an explanatory restriction reason for non-admin roles", () => {
    expect(getPauseRestrictionReason("admin")).toBeNull();
    expect(getPauseRestrictionReason("operator")).toMatch(/restricted to Admin/i);
    expect(getPauseRestrictionReason("auditor")).toMatch(/restricted to Admin/i);
  });
});

describe("PausePayrollDialog role tests", () => {
  beforeEach(() => {
    useWalletStore.setState({ publicKey: "GADMIN_TEST_KEY" });
  });

  it("disables the pause control and shows a restriction banner for an operator", () => {
    render(
      <PausePayrollDialog
        isOpen={true}
        payroll={mockPendingRun}
        userRole="operator"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByTestId("role-pause-restriction-alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Payroll" })).toBeDisabled();
  });

  it("disables the pause control and shows a restriction banner for an auditor", () => {
    render(
      <PausePayrollDialog
        isOpen={true}
        payroll={mockPendingRun}
        userRole="auditor"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByTestId("role-pause-restriction-alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Payroll" })).toBeDisabled();
  });

  it("requires a reason before an admin can confirm the pause", () => {
    render(
      <PausePayrollDialog
        isOpen={true}
        payroll={mockPendingRun}
        userRole="admin"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause Payroll" }));
    expect(
      screen.getByText(/describe why this run is being paused/i),
    ).toBeInTheDocument();
  });

  it("submits a pause request and calls onSuccess when the API call succeeds", async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ...mockPendingRun, status: "paused" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PausePayrollDialog
        isOpen={true}
        payroll={mockPendingRun}
        userRole="admin"
        onCancel={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText(/reason for pause/i), {
      target: { value: "Suspected duplicate batch under review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause Payroll" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/payroll/${mockPendingRun.id}/pause`,
      expect.objectContaining({ method: "PUT" }),
    );

    vi.unstubAllGlobals();
  });

  it("surfaces the API error message when the pause request is rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { code: "FORBIDDEN", message: "Admin role required to pause payroll." } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PausePayrollDialog
        isOpen={true}
        payroll={mockPendingRun}
        userRole="admin"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/reason for pause/i), {
      target: { value: "Suspected duplicate batch under review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause Payroll" }));

    await waitFor(() =>
      expect(screen.getByText(/admin role required to pause payroll/i)).toBeInTheDocument(),
    );

    vi.unstubAllGlobals();
  });
});

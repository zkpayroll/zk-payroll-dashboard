import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CancelPayrollDialog } from "@/components/features/payroll/CancelPayrollDialog";
import { usePayrollAuditTrailStore } from "@/stores/payrollAuditTrail";
import { useWalletStore } from "@/stores/walletStore";
import type { PayrollRun } from "@/types/models";

const pendingRun: PayrollRun = {
  id: "run_cancel_001",
  companyId: "company_001",
  timestamp: "2025-06-01T00:00:00Z",
  proof: "0xproof",
  employeeIds: ["emp_1", "emp_2"],
  status: "pending",
  totalAmount: 10000,
  employeeCount: 2,
  createdAt: "2025-06-01T00:00:00Z",
};

describe("Cancellation events surfaced in the payroll timeline (#769)", () => {
  beforeEach(() => {
    usePayrollAuditTrailStore.setState({ events: [] });
    useWalletStore.setState({ publicKey: "GOPERATORPUBLICKEY0000000000000000000000000000000000" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;
  });

  it("logs a 'cancelled' audit trail event once the cancellation succeeds (success path)", async () => {
    render(
      <CancelPayrollDialog
        isOpen={true}
        payroll={pendingRun}
        userRole="operator"
        onCancel={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/required cancellation reason/i), {
      target: { value: "OTHER" },
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel payroll/i }));

    await waitFor(() => {
      const events = usePayrollAuditTrailStore.getState().getEventsForRun(pendingRun.id);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe("cancelled");
      expect(events[0].payrollRunId).toBe(pendingRun.id);
    });
  });

  it("does not log an event when the cancellation request fails (failure path)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Cancellation rejected" } }),
    }) as unknown as typeof fetch;

    render(
      <CancelPayrollDialog
        isOpen={true}
        payroll={pendingRun}
        userRole="operator"
        onCancel={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText(/required cancellation reason/i), {
      target: { value: "OTHER" },
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel payroll/i }));

    await waitFor(() => {
      expect(screen.getByText(/Cancellation rejected/i)).toBeInTheDocument();
    });

    expect(usePayrollAuditTrailStore.getState().getEventsForRun(pendingRun.id)).toHaveLength(0);
  });

  it("does not log an event when no reason is selected (boundary: blocked before submit)", () => {
    render(
      <CancelPayrollDialog
        isOpen={true}
        payroll={pendingRun}
        userRole="operator"
        onCancel={() => {}}
        onSuccess={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel payroll/i }));

    expect(usePayrollAuditTrailStore.getState().getEventsForRun(pendingRun.id)).toHaveLength(0);
  });
});

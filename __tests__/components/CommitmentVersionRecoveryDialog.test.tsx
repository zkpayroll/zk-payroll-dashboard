import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommitmentVersionRecoveryDialog } from "@/components/features/employees/CommitmentVersionRecoveryDialog";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types/models";
import type { SalaryCommitmentVersion } from "@/lib/employees/salaryCommitmentVersionRecovery";

const employee: Employee = {
  id: "emp_rec_dialog_01",
  address: "GDIALOGRECOVERYADDRESS11111111111111111111111111111111111",
  name: "Arthur Curry",
  salary: 135000,
  salaryCommitment: "0x2222222222222222222222222222",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2024-01-01T00:00:00Z",
};

const historicalVersions: SalaryCommitmentVersion[] = [
  {
    id: "v1",
    employeeId: employee.id,
    version: 1,
    commitment: "0x1111111111111111111111111111",
    commitmentPreview: "0x11111111…",
    createdAt: "2024-01-01T00:00:00Z",
    status: "superseded",
  },
  {
    id: "v2",
    employeeId: employee.id,
    version: 2,
    commitment: "0x2222222222222222222222222222",
    commitmentPreview: "0x22222222…",
    createdAt: "2024-02-01T00:00:00Z",
    status: "active",
  },
];

describe("CommitmentVersionRecoveryDialog (#900, #962)", () => {
  beforeEach(() => {
    useEmployeeStore.setState({
      employees: [employee],
      commitmentReplacementLog: [
        {
          id: "log_1",
          employeeId: employee.id,
          changeKind: "commitment_only",
          previousCommitmentPreview: "0x11111111…",
          nextCommitmentPreview: "0x22222222…",
          previousCommitment: "0x1111111111111111111111111111",
          nextCommitment: "0x2222222222222222222222222222",
          confirmedAt: "2024-02-01T00:00:00Z",
          version: 2,
        },
      ],
    });
  });

  it("renders review summary and completes recovery when confirmed (success path)", () => {
    const onConfirmed = vi.fn();
    const onCancel = vi.fn();

    render(
      <CommitmentVersionRecoveryDialog
        isOpen={true}
        employee={employee}
        targetVersion={historicalVersions[0]}
        versionHistory={historicalVersions}
        confirmedBy="audit_lead"
        onCancel={onCancel}
        onConfirmed={onConfirmed}
      />,
    );

    expect(screen.getByTestId("commitment-recovery-summary")).toBeInTheDocument();
    expect(screen.getByText(/Target Version to Restore/i)).toBeInTheDocument();
    expect(screen.getByText(/v1 \(Superseded\)/i)).toBeInTheDocument();
    expect(screen.getByText(/New Version After Recovery/i)).toBeInTheDocument();
    expect(screen.getByText(/v3 \(Restored from v1\)/i)).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-recovery-btn");
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(onConfirmed).toHaveBeenCalled();

    const state = useEmployeeStore.getState();
    const updated = state.employees.find((e) => e.id === employee.id);
    expect(updated?.salaryCommitment).toBe("0x1111111111111111111111111111");
    expect(state.commitmentReplacementLog).toHaveLength(2);
    expect(state.commitmentReplacementLog[1].isRecovery).toBe(true);
  });

  it("blocks confirmation and shows actionable error when attempting to recover active version (failure path)", () => {
    const onConfirmed = vi.fn();

    render(
      <CommitmentVersionRecoveryDialog
        isOpen={true}
        employee={employee}
        targetVersion={historicalVersions[1]}
        versionHistory={historicalVersions}
        onCancel={() => {}}
        onConfirmed={onConfirmed}
      />,
    );

    expect(screen.getByTestId("commitment-recovery-error")).toBeInTheDocument();
    expect(screen.getByText(/VERSION_ALREADY_ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Select an earlier superseded version to restore/i)).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-recovery-btn");
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(useEmployeeStore.getState().commitmentReplacementLog).toHaveLength(1);
  });

  it("never exposes raw salary amount in the dialog", () => {
    render(
      <CommitmentVersionRecoveryDialog
        isOpen={true}
        employee={employee}
        targetVersion={historicalVersions[0]}
        versionHistory={historicalVersions}
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.queryByText(/135000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/135,000/)).not.toBeInTheDocument();
  });

  it("renders nothing when isOpen is false or targetVersion is null", () => {
    const { container, rerender } = render(
      <CommitmentVersionRecoveryDialog
        isOpen={false}
        employee={employee}
        targetVersion={historicalVersions[0]}
        versionHistory={historicalVersions}
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");

    rerender(
      <CommitmentVersionRecoveryDialog
        isOpen={true}
        employee={employee}
        targetVersion={null}
        versionHistory={historicalVersions}
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});

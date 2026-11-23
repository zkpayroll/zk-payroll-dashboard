import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import PayrollReviewRiskScoring from "@/components/features/payroll/PayrollReviewRiskScoring";
import { InactiveEmployeeWarning } from "@/components/warnings/InactiveEmployeeWarning";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES, MOCK_RESERVE_THRESHOLD_EXCEPTIONS } from "@/lib/api/mockData";
import { PendingPayrollObligationsPanel } from "@/components/features/payroll/PendingPayrollObligationsPanel";
import { PayrollAdjustmentApprovalExpiryPanel } from "@/components/features/payroll/PayrollAdjustmentApprovalExpiryPanel";
import { ReserveThresholdExceptionApprovals } from "@/components/features/payroll/ReserveThresholdExceptionApprovals";

export default function PayrollApprovalsPage() {
  const pendingRun = MOCK_PAYROLL_RUNS.find((r) => r.status === "pending");
  // Approval progress is tied to the draft version it was granted against.
  // Any draft change invalidates prior approvals so stale progress is never shown.
  const approvalRuns = MOCK_PAYROLL_RUNS.map((r) =>
    r.status === "pending" && r.draftChangedSinceApproval === true
      ? { ...r, approvals: [] }
      : r
  );
  const activePendingRun = approvalRuns.find((r) => r.status === "pending");

  return (
    <DashboardLayout>
      <PayrollAdjustmentApprovalExpiryPanel runs={approvalRuns} />
      <PendingPayrollObligationsPanel runs={approvalRuns} />
      <ReserveThresholdExceptionApprovals exceptions={MOCK_RESERVE_THRESHOLD_EXCEPTIONS} />
      {activePendingRun && (
        <>
          <InactiveEmployeeWarning
            employees={MOCK_EMPLOYEES}
            employeeIds={activePendingRun.employeeIds}
          />
          <PayrollReviewRiskScoring
            payrollRun={activePendingRun}
            employees={MOCK_EMPLOYEES}
          />
        </>
      )}
      <ExecutiveApprovalQueue />
    </DashboardLayout>
  );
}

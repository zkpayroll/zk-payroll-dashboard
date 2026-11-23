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

  return (
    <DashboardLayout>
      <PayrollAdjustmentApprovalExpiryPanel runs={MOCK_PAYROLL_RUNS} />
      <PendingPayrollObligationsPanel runs={MOCK_PAYROLL_RUNS} />
      <ReserveThresholdExceptionApprovals exceptions={MOCK_RESERVE_THRESHOLD_EXCEPTIONS} />
      {pendingRun && (
        <>
          <InactiveEmployeeWarning
            employees={MOCK_EMPLOYEES}
            employeeIds={pendingRun.employeeIds}
          />
          <PayrollReviewRiskScoring
            payrollRun={pendingRun}
            employees={MOCK_EMPLOYEES}
          />
        </>
      )}
      <ExecutiveApprovalQueue />
    </DashboardLayout>
  );
}

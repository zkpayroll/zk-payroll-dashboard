import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import PayrollReviewRiskScoring from "@/components/features/payroll/PayrollReviewRiskScoring";
import { InactiveEmployeeWarning } from "@/components/warnings/InactiveEmployeeWarning";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import { PendingPayrollObligationsPanel } from "@/components/features/payroll/PendingPayrollObligationsPanel";
import { PayrollAdjustmentApprovalExpiryPanel } from "@/components/features/payroll/PayrollAdjustmentApprovalExpiryPanel";
import { ApprovalInvalidationPanel } from "@/components/features/payroll/ApprovalInvalidationPanel";
import { getBatchDiffFixture } from "@/lib/payroll/batchDiffFixtures";

export default function PayrollApprovalsPage() {
  const pendingRun = MOCK_PAYROLL_RUNS.find((r) => r.status === "pending");
  const invalidationFixture = getBatchDiffFixture("commitment-change");

  return (
    <DashboardLayout>
      <PayrollAdjustmentApprovalExpiryPanel runs={MOCK_PAYROLL_RUNS} />
      <ApprovalInvalidationPanel
        input={{
          hasApproval: true,
          approvalStatus: "approved",
          approvedAt: "2026-11-18T09:00:00Z",
          currentRows: invalidationFixture.currentRows,
          approvedRows: invalidationFixture.approvedRows,
          currentRevisionNumber: 2,
          approvedRevisionNumber: 2,
          expectedRevisionNumber: 2,
        }}
        title="Approval invalidation validation"
      />
      <PendingPayrollObligationsPanel runs={MOCK_PAYROLL_RUNS} />
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

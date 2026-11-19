import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollFailureRecoveryCenter from "@/components/features/payroll/PayrollFailureRecoveryCenter";
import { ApprovalInvalidationPanel } from "@/components/features/payroll/ApprovalInvalidationPanel";
import { getBatchDiffFixture } from "@/lib/payroll/batchDiffFixtures";

function RecoveryPage() {
  const invalidationFixture = getBatchDiffFixture("removals");

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
          title="Approval invalidation recovery"
        />
        <PayrollFailureRecoveryCenter />
      </div>
    </DashboardLayout>
  );
}

export default RecoveryPage;

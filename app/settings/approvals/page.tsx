import DashboardLayout from "@/components/layout/DashboardLayout";
import ApproverThresholdRotation from "@/components/features/settings/ApproverThresholdRotation";
import DelegatedApproverPanel from "@/components/features/approvals/DelegatedApproverPanel";
import ReserveThresholdExceptionApprovals from "@/components/features/approvals/ReserveThresholdExceptionApprovals";

function ApprovalSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ApproverThresholdRotation />
        <DelegatedApproverPanel />
        <ReserveThresholdExceptionApprovals />
      </div>
    </DashboardLayout>
  );
}

export default ApprovalSettingsPage;

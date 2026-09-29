import DashboardLayout from "@/components/layout/DashboardLayout";
import ApproverThresholdRotation from "@/components/features/settings/ApproverThresholdRotation";
import DelegatedApproverPanel from "@/components/features/approvals/DelegatedApproverPanel";

function ApprovalSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ApproverThresholdRotation />
        <DelegatedApproverPanel />
      </div>
    </DashboardLayout>
  );
}

export default ApprovalSettingsPage;


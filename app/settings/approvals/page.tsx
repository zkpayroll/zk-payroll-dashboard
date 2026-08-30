import DashboardLayout from "@/components/layout/DashboardLayout";
import ApproverThresholdRotation from "@/components/features/settings/ApproverThresholdRotation";

function ApprovalSettingsPage() {
  return (
    <DashboardLayout>
      <ApproverThresholdRotation />
    </DashboardLayout>
  );
}

export default ApprovalSettingsPage;

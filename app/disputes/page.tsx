import DashboardLayout from "@/components/layout/DashboardLayout";
import DisputeResolutionQueue from "@/components/features/disputes/DisputeResolutionQueue";

function DisputesPage() {
  return (
    <DashboardLayout>
      <DisputeResolutionQueue />
    </DashboardLayout>
  );
}

export default DisputesPage;

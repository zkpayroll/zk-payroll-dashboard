import DashboardLayout from "@/components/layout/DashboardLayout";
import CapabilityMismatchPanel from "@/components/features/capabilities/CapabilityMismatchPanel";

function CapabilitiesPage() {
  return (
    <DashboardLayout>
      <CapabilityMismatchPanel />
    </DashboardLayout>
  );
}

export default CapabilitiesPage;

import DashboardLayout from "@/components/layout/DashboardLayout";
import EvidencePointerManager from "@/components/features/compliance/EvidencePointerManager";

function ComplianceEvidencePage() {
  return (
    <DashboardLayout>
      <EvidencePointerManager />
    </DashboardLayout>
  );
}

export default ComplianceEvidencePage;

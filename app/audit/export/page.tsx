import DashboardLayout from "@/components/layout/DashboardLayout";
import AuditExportWizard from "@/components/features/audit/AuditExportWizard";

function AuditExportPage() {
  return (
    <DashboardLayout>
      <AuditExportWizard />
    </DashboardLayout>
  );
}

export default AuditExportPage;

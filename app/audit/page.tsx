import DashboardLayout from "@/components/layout/DashboardLayout";
import AttestationDigestPage from "@/components/features/audit/AttestationDigestPage";

function AuditPage() {
  return (
    <DashboardLayout>
      <AttestationDigestPage />
    </DashboardLayout>
  );
}

export default AuditPage;

import { CompanyConfigurationRevisions } from "@/components/features/company/CompanyConfigurationRevisions";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AdminOverview from "@/components/features/admin/AdminOverview";

function AdminPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AdminOverview />
        <CompanyConfigurationRevisions />
      </div>
    </DashboardLayout>
  );
}

export default AdminPage;

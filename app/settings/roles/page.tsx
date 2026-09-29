import DashboardLayout from "@/components/layout/DashboardLayout";
import RoleViewer from "@/components/features/admin/RoleViewer";
import OwnerTransferReviewContainer from "@/components/features/settings/OwnerTransferReviewContainer";

function SettingsRolesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-10">
        <RoleViewer />
        <OwnerTransferReviewContainer />
      </div>
    </DashboardLayout>
  );
}

export default SettingsRolesPage;

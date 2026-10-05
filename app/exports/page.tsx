import DashboardLayout from "@/components/layout/DashboardLayout";
import ExportCenter from "@/components/features/exports/ExportCenter";
import ExportPermissionsMatrix from "@/components/features/exports/ExportPermissionsMatrix";

function ExportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ExportCenter />
        <ExportPermissionsMatrix />
      </div>
    </DashboardLayout>
  );
}

export default ExportsPage;
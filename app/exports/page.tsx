import DashboardLayout from "@/components/layout/DashboardLayout";
import ExportCenter from "@/components/features/exports/ExportCenter";
import ExportPermissionsMatrix from "@/components/features/exports/ExportPermissionsMatrix";
import LedgerExportConsistencyValidator from "@/components/features/exports/LedgerExportConsistencyValidator";

function ExportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ExportCenter />
        <LedgerExportConsistencyValidator />
        <ExportPermissionsMatrix />
      </div>
    </DashboardLayout>
  );
}

export default ExportsPage;

import DashboardLayout from "@/components/layout/DashboardLayout";
import ReconciliationPanel from "@/components/features/reconciliation/ReconciliationPanel";

function ReconciliationPage() {
  return (
    <DashboardLayout>
      <ReconciliationPanel />
    </DashboardLayout>
  );
}

export default ReconciliationPage;
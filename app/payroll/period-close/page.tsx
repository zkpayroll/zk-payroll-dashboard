import DashboardLayout from "@/components/layout/DashboardLayout";
import PeriodCloseDashboard from "@/components/features/reconciliation/PeriodCloseDashboard";

function PeriodClosePage() {
  return (
    <DashboardLayout>
      <PeriodCloseDashboard />
    </DashboardLayout>
  );
}

export default PeriodClosePage;

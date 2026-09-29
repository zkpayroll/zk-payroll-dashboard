import DashboardLayout from "@/components/layout/DashboardLayout";
import PeriodCloseDashboard from "@/components/features/reconciliation/PeriodCloseDashboard";

function PeriodClosePage() {
  return (
    <DashboardLayout>
      <PeriodCloseDashboard
        requirePrerequisiteChecks
        onPrerequisiteError={(error) => {
          console.error("Pay period closure prerequisite check failed:", error);
        }}
      />
    </DashboardLayout>
  );
}

export default PeriodClosePage;

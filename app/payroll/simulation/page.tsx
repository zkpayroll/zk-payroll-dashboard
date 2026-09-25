import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollSimulationReview from "@/components/features/simulation/PayrollSimulationReview";

function PayrollSimulationPage() {
  return (
    <DashboardLayout>
      <PayrollSimulationReview />
    </DashboardLayout>
  );
}

export default PayrollSimulationPage;

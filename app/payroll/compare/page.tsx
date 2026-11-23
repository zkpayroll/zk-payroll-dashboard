import DashboardLayout from "@/components/layout/DashboardLayout";
import BatchDiffReviewScreen from "@/components/features/batches/BatchDiffReviewScreen";

function PayrollComparePage() {
  return (
    <DashboardLayout>
      <BatchDiffReviewScreen />
    </DashboardLayout>
  );
}

export default PayrollComparePage;

import DashboardLayout from "@/components/layout/DashboardLayout";
import BulkExceptionReview from "@/components/features/employees/BulkExceptionReview";

function BulkExceptionsPage() {
  return (
    <DashboardLayout>
      <BulkExceptionReview />
    </DashboardLayout>
  );
}

export default BulkExceptionsPage;

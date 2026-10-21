import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollExceptionTriage from "@/components/triage/PayrollExceptionTriage";
import ExceptionOwnershipTracker from "@/components/triage/ExceptionOwnershipTracker";

function ExceptionsPage() {
  return (
    <DashboardLayout>
      <PayrollExceptionTriage />
      <ExceptionOwnershipTracker />
    </DashboardLayout>
  );
}

export default ExceptionsPage;

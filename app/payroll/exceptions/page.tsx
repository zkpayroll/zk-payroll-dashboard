import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollExceptionTriage from "@/components/triage/PayrollExceptionTriage";
import ExceptionOwnershipTracker from "@/components/triage/ExceptionOwnershipTracker";
import ReserveThresholdExceptionApprovals from "@/components/triage/ReserveThresholdExceptionApprovals";

function ExceptionsPage() {
  return (
    <DashboardLayout>
      <PayrollExceptionTriage />
      <ExceptionOwnershipTracker />
      <ReserveThresholdExceptionApprovals />
    </DashboardLayout>
  );
}

export default ExceptionsPage;

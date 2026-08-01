import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollLockReasonViewer from "@/components/features/payroll/PayrollLockReasonViewer";

function LocksPage() {
  return (
    <DashboardLayout>
      <PayrollLockReasonViewer />
    </DashboardLayout>
  );
}

export default LocksPage;
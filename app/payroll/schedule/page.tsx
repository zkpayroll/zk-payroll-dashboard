import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollScheduleCollisionDetector from "@/components/features/payroll/PayrollScheduleCollisionDetector";

function PayrollSchedulePage() {
  return (
    <DashboardLayout>
      <PayrollScheduleCollisionDetector />
    </DashboardLayout>
  );
}

export default PayrollSchedulePage;

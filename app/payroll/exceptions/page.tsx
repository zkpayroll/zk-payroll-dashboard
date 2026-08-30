import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollExceptionTriage from "@/components/triage/PayrollExceptionTriage";

function ExceptionsPage() {
  return (
    <DashboardLayout>
      <PayrollExceptionTriage />
    </DashboardLayout>
  );
}

export default ExceptionsPage;

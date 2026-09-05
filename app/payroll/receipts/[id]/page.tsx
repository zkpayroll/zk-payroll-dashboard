import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollReceiptView from "@/components/features/payroll/PayrollReceiptView";

function PayrollReceiptPage() {
  return (
    <DashboardLayout>
      <PayrollReceiptView />
    </DashboardLayout>
  );
}

export default PayrollReceiptPage;
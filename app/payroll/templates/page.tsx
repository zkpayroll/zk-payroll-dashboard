import DashboardLayout from "@/components/layout/DashboardLayout";
import RecurringPayrollTemplateEditor from "@/components/features/payroll/RecurringPayrollTemplateEditor";

function TemplatesPage() {
  return (
    <DashboardLayout>
      <RecurringPayrollTemplateEditor />
    </DashboardLayout>
  );
}

export default TemplatesPage;
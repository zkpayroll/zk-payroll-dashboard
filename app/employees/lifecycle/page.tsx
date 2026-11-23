import DashboardLayout from "@/components/layout/DashboardLayout";
import EmployeeLifecycleManager from "@/components/features/employees/EmployeeLifecycleManager";

export const metadata = {
  title: "Employee Lifecycle Management | ZK Payroll",
  description: "Focused administrative interface for activating, suspending, and offboarding employees.",
};

export default function EmployeeLifecyclePage() {
  return (
    <DashboardLayout>
      <EmployeeLifecycleManager />
    </DashboardLayout>
  );
}

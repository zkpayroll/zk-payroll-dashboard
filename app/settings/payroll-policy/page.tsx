import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollPolicyEditor from "@/components/features/policy/PayrollPolicyEditor";

export const metadata = {
  title: "Payroll Policy Editor | ZK Payroll",
  description:
    "Configure settlement windows, reserve rules, approval requirements, capacity limits, and audit retention settings.",
};

export default function PayrollPolicyPage() {
  return (
    <DashboardLayout>
      <PayrollPolicyEditor />
    </DashboardLayout>
  );
}

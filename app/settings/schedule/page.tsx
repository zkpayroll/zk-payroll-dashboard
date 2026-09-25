import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollScheduleEditor from "@/components/features/schedule/PayrollScheduleEditor";

function ScheduleEditorPage() {
  return (
    <DashboardLayout>
      <PayrollScheduleEditor />
    </DashboardLayout>
  );
}

export default ScheduleEditorPage;

import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollScheduleEditor from "@/components/features/schedule/PayrollScheduleEditor";
import TimezoneDisplayPreference from "@/components/timezone/TimezoneDisplayPreference";

function ScheduleEditorPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TimezoneDisplayPreference />
        <PayrollScheduleEditor />
      </div>
    </DashboardLayout>
  );
}

export default ScheduleEditorPage;

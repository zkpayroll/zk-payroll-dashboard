import DashboardLayout from "@/components/layout/DashboardLayout";
import TimezoneDisplayPreference from "@/components/timezone/TimezoneDisplayPreference";

export const metadata = {
  title: "Timezone Display | ZK Payroll",
  description: "Choose how payroll schedule times are displayed: local, organization, or UTC.",
};

function TimezoneSettingsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timezone Display</h1>
          <p className="text-sm text-gray-600 mt-1">
            Keep distributed approval teams aligned on payroll deadlines by picking one display
            timezone for schedule times.
          </p>
        </div>
        <TimezoneDisplayPreference />
      </div>
    </DashboardLayout>
  );
}

export default TimezoneSettingsPage;

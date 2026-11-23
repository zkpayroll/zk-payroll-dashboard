import DashboardLayout from "@/components/layout/DashboardLayout";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import PartialReleaseFailureAlert from "@/components/features/treasury/PartialReleaseFailureAlert";
import { MOCK_PARTIAL_RELEASE_FAILURES } from "@/lib/api/mockData";

function IncidentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">System notices</h2>
        <IncidentBanner
          variant="maintenance"
          message="Scheduled maintenance window: 02:00–04:00 UTC. Payroll submissions will be queued."
          dismissible
        />
        <IncidentBanner
          variant="warning"
          message="Treasury balance is below the recommended buffer. Fund your account before next payroll."
        />
        {MOCK_PARTIAL_RELEASE_FAILURES.map((failure) => (
          <PartialReleaseFailureAlert key={failure.releaseId} failure={failure} />
        ))}
      </div>
    </DashboardLayout>
  );
}

export default IncidentsPage;

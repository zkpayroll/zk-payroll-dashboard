import DashboardLayout from "@/components/layout/DashboardLayout";
import AuditorArchivedPeriodsView from "@/components/features/audit/AuditorArchivedPeriodsView";

export const metadata = {
  title: "Archived Payroll Periods (Auditor) | ZK Payroll",
  description: "Read-only, redacted auditor view of archived payroll periods.",
};

export default function AuditorArchivedPeriodsPage({
  searchParams,
}: {
  searchParams?: { period?: string | string[] };
}) {
  const raw = searchParams?.period;
  const period = Array.isArray(raw) ? raw[0] : raw;

  return (
    <DashboardLayout>
      <AuditorArchivedPeriodsView period={period ?? null} />
    </DashboardLayout>
  );
}

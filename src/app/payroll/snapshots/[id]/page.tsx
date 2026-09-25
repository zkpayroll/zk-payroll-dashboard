import DashboardLayout from "@/components/layout/DashboardLayout";
import SnapshotDetail from "@/src/components/snapshots/SnapshotDetail";

interface SnapshotDetailPageProps {
  params: { id: string };
}

export default function SnapshotDetailPage({ params }: SnapshotDetailPageProps) {
  return (
    <DashboardLayout>
      <SnapshotDetail snapshotId={params.id} />
    </DashboardLayout>
  );
}

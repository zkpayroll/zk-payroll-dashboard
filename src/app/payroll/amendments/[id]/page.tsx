import DashboardLayout from "@/components/layout/DashboardLayout";
import AmendmentDetail from "@/src/components/amendments/AmendmentDetail";

interface AmendmentDetailPageProps {
  params: { id: string };
}

export default function AmendmentDetailPage({ params }: AmendmentDetailPageProps) {
  return (
    <DashboardLayout>
      <AmendmentDetail amendmentId={params.id} />
    </DashboardLayout>
  );
}

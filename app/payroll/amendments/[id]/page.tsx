import { type Metadata } from "next";
import { notFound } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AmendmentDetail from "@/src/components/amendments/AmendmentDetail";

interface AmendmentDetailPageProps {
  params: { id: string };
}

const AMENDMENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export const metadata: Metadata = {
  title: "Payroll Amendment | ZK Payroll",
  description: "Review and manage post-submission adjustments for a payroll amendment.",
};

export default function AmendmentDetailPage({ params }: AmendmentDetailPageProps) {
  const id = params.id?.trim();

  if (!id || !AMENDMENT_ID_PATTERN.test(id)) {
    notFound();
  }

  return (
    <DashboardLayout>
      <AmendmentDetail amendmentId={id} />
    </DashboardLayout>
  );
}

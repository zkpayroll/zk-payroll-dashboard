import DashboardLayout from "@/components/layout/DashboardLayout";
import ApprovalCommentHistory from "@/components/features/payroll/ApprovalCommentHistory";

function CommentsPage() {
  return (
    <DashboardLayout>
      <ApprovalCommentHistory />
    </DashboardLayout>
  );
}

export default CommentsPage;
import DashboardLayout from "@/components/layout/DashboardLayout";
import TreasuryView, { type TreasuryViewProps } from "@/components/features/treasury/TreasuryView";

export type TreasuryPageProps = TreasuryViewProps;

function TreasuryPage(props: TreasuryPageProps = {}) {
  return (
    <DashboardLayout>
      <TreasuryView {...props} />
    </DashboardLayout>
  );
}

export default TreasuryPage;

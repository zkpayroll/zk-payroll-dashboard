import DashboardLayout from "@/components/layout/DashboardLayout";
import { AssetAllowlist } from "@/components/assets/AssetAllowlist";

export const metadata = {
  title: "Asset Allowlist | Settings",
  description: "View supported payroll assets.",
};

export default function AssetAllowlistPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        </div>
        <AssetAllowlist />
      </div>
    </DashboardLayout>
  );
}

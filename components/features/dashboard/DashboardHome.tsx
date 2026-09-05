"use client";

import { Wallet, Building2, Loader2 } from "lucide-react";
import OverduePayrollAlertBanner from "@/components/features/payroll/OverduePayrollAlertBanner";
import { useStellar } from "@/components/providers/StellarProvider";
import { useWalletStore } from "@/stores/walletStore";
import { useCompanyStore } from "@/stores/company";
import WalletConnect from "@/components/features/wallet/WalletConnect";
import PayrollSummary from "@/components/features/payroll/PayrollSummary";
import PeriodSummaryCard from "@/components/features/payroll/PeriodSummaryCard";
import SystemStatus from "@/components/features/dashboard/SystemStatus";
import QuickActions from "@/components/features/dashboard/QuickActions";
import OnboardingChecklistPanel from "@/components/features/dashboard/OnboardingChecklistPanel";
import OnboardingReadinessTracker from "@/components/features/employees/OnboardingReadinessTracker";
import PinnedAlertsPanel from "@/components/features/dashboard/PinnedAlertsPanel";
import { SessionTimeoutBanner } from "@/components/features/dashboard/SessionTimeoutBanner";
import ErrorBoundary from "@/components/ErrorBoundary";

function DashboardHome() {
  const { isFreighterInstalled } = useStellar();
  const { isConnected, isLoading } = useWalletStore();
  const company = useCompanyStore((s) => s.company);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2
          className="w-8 h-8 text-indigo-600 animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-gray-500">Connecting to wallet…</p>
      </div>
    );
  }

  if (!isFreighterInstalled || !isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
          <Wallet className="w-7 h-7 text-indigo-600" aria-hidden="true" />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Connect your wallet to get started
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            ZK Payroll requires a Freighter wallet on Stellar Testnet. Connect
            to access the dashboard.
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Building2
            className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">
              Company setup required
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Complete your company setup to start managing payroll.
            </p>
          </div>
          <a
            href="/setup"
            className="shrink-0 px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Set up now
          </a>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center py-8">
            <h3 className="text-sm font-medium text-gray-500">
              Dashboard data will appear after company setup is complete.
            </h3>
          </div>
        </div>
      </div>
    );
  }

  // Sample alerts and tasks for demo purposes
  const sampleAlerts = [
    {
      id: "alert-1",
      title: "Treasury balance below threshold",
      message:
        "Current balance may be insufficient for next scheduled payroll run",
      severity: "warning" as const,
      status: "pending" as const,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      link: "/treasury",
      actionLabel: "Fund treasury",
    },
  ];

  const sampleTasks = [
    {
      id: "task-1",
      title: "Review pending audit request",
      description: "New audit access request requires approval",
      priority: "high" as const,
      status: "pending" as const,
      link: "/compliance",
      actionLabel: "Review request",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {company.name}
          </h2>
          <p className="text-sm text-gray-500">Admin dashboard</p>
        </div>
        <WalletConnect />
      </div>
      <ErrorBoundary>
        <OverduePayrollAlertBanner />
        <SessionTimeoutBanner />
      </ErrorBoundary>
      <ErrorBoundary>
        <PinnedAlertsPanel alerts={sampleAlerts} tasks={sampleTasks} />
      </ErrorBoundary>
      <ErrorBoundary>
        <QuickActions />
      </ErrorBoundary>
      <ErrorBoundary>
        <OnboardingChecklistPanel />
      </ErrorBoundary>
      <ErrorBoundary>
        <OnboardingReadinessTracker />
      </ErrorBoundary>
      <ErrorBoundary>
        <SystemStatus />
      </ErrorBoundary>
      <ErrorBoundary>
        <PeriodSummaryCard />
      </ErrorBoundary>
      <ErrorBoundary>
        <PayrollSummary />
      </ErrorBoundary>
    </div>
  );
}

export default DashboardHome;

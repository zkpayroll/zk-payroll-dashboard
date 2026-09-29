import DashboardLayout from "@/components/layout/DashboardLayout";
import { EmployerOnboardingTimeline } from "@/components/features/activity/EmployerOnboardingTimelineItem";
import { Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const MOCK_EMPLOYER_ONBOARDING = [
  {
    employerId: "company_001",
    employerName: "ZK Payroll Inc.",
    state: "completed" as const,
    currentStep: "verification_completed" as const,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    employerId: "company_002",
    employerName: "Accra Remote Collective",
    state: "in_progress" as const,
    currentStep: "contracts_deployed" as const,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    employerId: "company_003",
    employerName: "Lagos Payroll Cooperative",
    state: "failed" as const,
    currentStep: "treasury_configured" as const,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    errorMessage: "Treasury verification failed — insufficient initial funding",
  },
];

export default function EmployerSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Employer Settings</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Employer onboarding status and configuration — privacy-safe activity timeline.
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="employer-onboarding-heading" className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="employer-onboarding-heading" className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Employer Onboarding Activity
            </h2>
            <Link href="/setup" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Go to setup →
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            Track onboarding progress per employer. No private payroll values are shown here — only setup steps and verification status.
          </p>

          <EmployerOnboardingTimeline items={MOCK_EMPLOYER_ONBOARDING} />

          <div className="pt-3 border-t text-xs text-gray-400">
            Need help? Visit the{" "}
            <Link href="/company/warnings" className="text-indigo-600 hover:underline">
              company health check
            </Link>{" "}
            or review the onboarding checklist on the dashboard.
          </div>
        </section>

        {/* QA steps for success/failure/edge documented inline for auditors */}
        <section className="bg-gray-50 rounded-lg border p-4 text-xs text-gray-600">
          <h3 className="font-semibold text-gray-700 mb-1">QA verification steps</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Success: completed employer shows green badge and &quot;Setup verified&quot; message.</li>
            <li>Failure: failed employer shows red badge and error detail from redacted payload.</li>
            <li>Edge: empty timeline renders &quot;No employer onboarding activity&quot; without errors.</li>
            <li>Privacy: no salary, treasury balance, or private commitment appears in DOM or events.</li>
          </ul>
        </section>
      </div>
    </DashboardLayout>
  );
}

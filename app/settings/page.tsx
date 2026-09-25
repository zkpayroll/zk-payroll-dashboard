import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Sliders, Building2, Landmark, Shield, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Settings | ZK Payroll",
  description: "Manage system configuration, payroll policies, company profiles, and security controls.",
};

const SETTINGS_SECTIONS = [
  {
    title: "Payroll Policy Editor",
    description:
      "Configure settlement windows, reserve rules, approval requirements, capacity limits, and audit retention settings.",
    href: "/settings/payroll-policy",
    icon: Sliders,
    badge: "Active",
  },
  {
    title: "Company Setup & Contracts",
    description:
      "Inspect Soroban contract IDs, network environments, and company health status checks.",
    href: "/setup",
    icon: Building2,
    badge: "Core",
  },
  {
    title: "Treasury & Liquidity",
    description:
      "Monitor reserve balances, replenishment buffers, and multi-sig vault accounts.",
    href: "/treasury",
    icon: Landmark,
    badge: "Admin",
  },
  {
    title: "Compliance & Audit",
    description:
      "Review ZK verification proofs, privacy preservation levels, and export audit trails.",
    href: "/compliance",
    icon: Shield,
    badge: "Security",
  },
];

export default function SettingsHubPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings & Configuration</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage organization-wide governance, smart contract parameters, and cryptographic policies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="block group bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {section.badge}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-gray-900 mt-4 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                  {section.title}
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-600" aria-hidden="true" />
                </h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {section.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

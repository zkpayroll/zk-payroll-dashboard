"use client";

import OrganizationPayrollSettingsSummary from "@/components/settings/OrganizationPayrollSettingsSummary";
import type { CompanyConfig } from "@/types";

const MOCK_COMPANY_CONFIG: CompanyConfig = {
  id: "comp_default_01",
  name: "ZKPAYROLL DEMO CORP",
  admin: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  treasury: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF",
  employeeCount: 25,
  isActive: true,
  network: "TESTNET",
  contracts: {
    registry: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    verifier: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF",
    executor: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF",
    audit: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDWHF",
    commitment: "CEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEWHF",
  },
  auditSettings: {
    enabled: true,
    retentionDays: 90,
    requireAuditorApproval: true,
  },
};

export default function OrganizationPayrollSettingsSummaryPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-5xl">
      <OrganizationPayrollSettingsSummary config={MOCK_COMPANY_CONFIG} />
    </main>
  );
}

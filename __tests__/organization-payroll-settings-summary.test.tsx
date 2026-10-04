import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OrganizationPayrollSettingsSummary from "@/components/settings/OrganizationPayrollSettingsSummary";
import { buildOrganizationPayrollSettingsSummary } from "@/src/settings/summary";
import type { CompanyConfig } from "@/types";

const VALID_STELLAR_ADMIN = "G" + "A".repeat(55);
const VALID_STELLAR_TREASURY = "G" + "B".repeat(55);
const VALID_CONTRACT = "C" + "A".repeat(55);

const validConfig: CompanyConfig = {
  id: "company_summary_test",
  name: "Acme Payroll Org",
  admin: VALID_STELLAR_ADMIN,
  treasury: VALID_STELLAR_TREASURY,
  employeeCount: 15,
  isActive: true,
  network: "TESTNET",
  contracts: {
    registry: VALID_CONTRACT,
    verifier: VALID_CONTRACT,
    executor: VALID_CONTRACT,
    audit: VALID_CONTRACT,
    commitment: VALID_CONTRACT,
  },
  auditSettings: {
    enabled: true,
    retentionDays: 180,
    requireAuditorApproval: true,
  },
};

describe("OrganizationPayrollSettingsSummary", () => {
  it("renders organization network, treasury, assets, and audit settings for valid config", () => {
    render(<OrganizationPayrollSettingsSummary config={validConfig} />);

    expect(screen.getByTestId("org-payroll-settings-summary")).toBeInTheDocument();
    expect(screen.getByText("Acme Payroll Org")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();

    expect(screen.getByTestId("settings-section-network")).toBeInTheDocument();
    expect(screen.getByTestId("settings-section-treasury")).toBeInTheDocument();
    expect(screen.getByTestId("settings-section-assets")).toBeInTheDocument();
    expect(screen.getByTestId("settings-section-audit")).toBeInTheDocument();

    expect(screen.getByText("180 days")).toBeInTheDocument();
  });

  it("renders warning banner when treasury is unlinked or config is missing", () => {
    const incompleteConfig: CompanyConfig = {
      ...validConfig,
      treasury: "",
    };

    render(<OrganizationPayrollSettingsSummary config={incompleteConfig} />);

    expect(screen.getByText("Action Required")).toBeInTheDocument();
    expect(
      screen.getByText("Treasury account is not linked to this organization."),
    ).toBeInTheDocument();
  });

  it("handles null or undefined config gracefully", () => {
    render(<OrganizationPayrollSettingsSummary config={null} />);

    expect(screen.getByText("Unconfigured Organization")).toBeInTheDocument();
    expect(
      screen.getByText("Organization payroll configuration is missing or uninitialized."),
    ).toBeInTheDocument();
  });

  it("buildOrganizationPayrollSettingsSummary does not expose private payroll or salary data", () => {
    const summary = buildOrganizationPayrollSettingsSummary(validConfig);
    const jsonString = JSON.stringify(summary);

    // Verify no salary fields, employee payments, or sensitive secrets are present
    expect(jsonString).not.toContain("salary");
    expect(jsonString).not.toContain("salaryCommitment");
    expect(summary.companyName).toBe("Acme Payroll Org");
    expect(summary.isConfigured).toBe(true);
  });
});

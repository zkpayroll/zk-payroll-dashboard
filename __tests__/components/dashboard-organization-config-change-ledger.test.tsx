import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DashboardOrganizationConfigChangeLedger from "@/components/features/dashboard/DashboardOrganizationConfigChangeLedger";
import { useConfigurationChangeLedger } from "@/stores/configurationChangeLedger";
import { useCompanyStore } from "@/stores/company";
import { usePayrollPolicyStore } from "@/stores/payrollPolicy";

vi.mock("@/stores/company", () => ({
  useCompanyStore: vi.fn(),
}));

vi.mock("@/stores/payrollPolicy", () => ({
  usePayrollPolicyStore: vi.fn(),
}));

vi.mock("@/stores/configurationChangeLedger", async () => {
  const actual = await vi.importActual("@/stores/configurationChangeLedger");
  return {
    ...actual,
    useConfigurationChangeLedger: vi.fn(),
  };
});

describe("DashboardOrganizationConfigChangeLedger", () => {
  const mockCompany = {
    id: "company_001",
    name: "ZK Payroll Inc.",
    admin: "G" + "A".repeat(55),
    treasury: "G" + "B".repeat(55),
    employeeCount: 2,
    isActive: true,
    network: "TESTNET" as const,
    contracts: {
      registry: "C" + "A".repeat(55),
      commitment: "C" + "B".repeat(55),
      verifier: "C" + "C".repeat(55),
      executor: "C" + "D".repeat(55),
      audit: "C" + "E".repeat(55),
    },
  };

  const mockPolicy = {
    id: "policy_default",
    companyId: "company_001",
    version: 3,
    updatedAt: "2026-08-20T10:00:00.000Z",
    updatedBy: "Admin",
    timing: { settlementWindowHours: 24, cutoffLeadTimeHours: 4, executionGracePeriodHours: 12, autoSettle: false },
    reserves: { minReservePercentage: 20, minReserveFixedAmount: 25000, replenishThresholdPercentage: 15, shortfallPolicy: "block" as const },
    approvals: { requiredApprovalsCount: 2, requireDualApproval: true, dualApprovalThreshold: 50000, allowSelfApproval: false, requireAuditorApproval: true },
    capacity: { maxBatchSize: 500, maxTotalDisbursement: 500000, dailyDisbursementLimit: 1000000, maxConsecutiveBatches: 4 },
    auditRetention: { retentionPeriodDays: 365, immutableAuditLog: true, requireAuditorExportSignoff: true, detailedTelemetry: true },
  };

  const sampleEntries = [
    {
      id: "config_change_1",
      type: "policy_updated",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      actor: "Admin User",
      actorRole: "admin",
      summary: "Payroll policy updated from version 2 to 3",
      details: { previousVersion: 2, newVersion: 3, changedSections: ["approvals"] },
      previousVersion: 2,
      newVersion: 3,
    },
    {
      id: "config_change_2",
      type: "company_updated",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      actor: "Admin User",
      actorRole: "admin",
      summary: "Company name changed from 'Old Name' to 'ZK Payroll Inc.'",
      details: { previousName: "Old Name", newName: "ZK Payroll Inc." },
    },
    {
      id: "config_change_3",
      type: "schema_migrated",
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      actor: "System",
      actorRole: "system",
      summary: "Organization configuration schema migrated from version 1 to 2",
      details: { previousSchemaVersion: 1, newSchemaVersion: 2 },
      schemaVersion: 2,
    },
    {
      id: "config_change_4",
      type: "contracts_updated",
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      actor: "Admin User",
      actorRole: "admin",
      summary: "Registry contract updated",
      details: { contractType: "registry", previous: "C" + "A".repeat(55), current: "C" + "F".repeat(55) },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useCompanyStore.mockReturnValue(mockCompany);
    usePayrollPolicyStore.mockReturnValue({ savedPolicy: mockPolicy });
    useConfigurationChangeLedger.mockReturnValue({
      entries: sampleEntries,
      filter: "all",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => sampleEntries,
      setFilter: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleSortDirection: vi.fn(),
    });
  });

  it("renders the ledger heading and change count", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getByRole("heading", { name: /Organization Configuration Change Ledger/i })).toBeInTheDocument();
    expect(screen.getByText(/4 changes/i)).toBeInTheDocument();
  });

  it("renders each change entry with type label, summary, and timestamp", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getAllByText("Policy Updated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Company Updated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Schema Migrated").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contracts Updated").length).toBeGreaterThan(0);

    expect(screen.getByText(/Payroll policy updated from version 2 to 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Company name changed from 'Old Name' to 'ZK Payroll Inc.'/i)).toBeInTheDocument();
    expect(screen.getByText(/Organization configuration schema migrated from version 1 to 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Registry contract updated/i)).toBeInTheDocument();
  });

  it("displays actor and role for each change", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getAllByText(/Admin User \(admin\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/System \(system\)/i)).toBeInTheDocument();
  });

  it("shows version information when available", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getByText(/v2 → v3/i)).toBeInTheDocument();
    expect(screen.getByText(/Schema v2/i)).toBeInTheDocument();
  });

  it("has search input that filters changes", () => {
    const mockSetSearchQuery = vi.fn();
    useConfigurationChangeLedger.mockReturnValue({
      entries: sampleEntries,
      filter: "all",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => sampleEntries,
      setFilter: vi.fn(),
      setSearchQuery: mockSetSearchQuery,
      toggleSortDirection: vi.fn(),
    });

    render(<DashboardOrganizationConfigChangeLedger />);

    const searchInput = screen.getByPlaceholderText(/Search changes/i);
    fireEvent.change(searchInput, { target: { value: "policy" } });

    expect(mockSetSearchQuery).toHaveBeenCalledWith("policy");
  });

  it("has filter select for change types", () => {
    const mockSetFilter = vi.fn();
    useConfigurationChangeLedger.mockReturnValue({
      entries: sampleEntries,
      filter: "all",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => sampleEntries,
      setFilter: mockSetFilter,
      setSearchQuery: vi.fn(),
      toggleSortDirection: vi.fn(),
    });

    render(<DashboardOrganizationConfigChangeLedger />);

    const filterSelect = screen.getByLabelText(/Filter by change type/i);
    fireEvent.change(filterSelect, { target: { value: "policy_updated" } });

    expect(mockSetFilter).toHaveBeenCalledWith("policy_updated");
  });

  it("has sort toggle button", () => {
    const mockToggleSortDirection = vi.fn();
    useConfigurationChangeLedger.mockReturnValue({
      entries: sampleEntries,
      filter: "all",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => sampleEntries,
      setFilter: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleSortDirection: mockToggleSortDirection,
    });

    render(<DashboardOrganizationConfigChangeLedger />);

    const sortButton = screen.getByRole("button", { name: /Sort ascending/i });
    fireEvent.click(sortButton);

    expect(mockToggleSortDirection).toHaveBeenCalledTimes(1);
  });

  it("shows expandable details for entries with details", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    const detailsSummary = screen.getAllByText(/Show details/i);
    expect(detailsSummary.length).toBeGreaterThan(0);
  });

  it("limits displayed entries with maxEntries prop", () => {
    render(<DashboardOrganizationConfigChangeLedger maxEntries={2} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length).toBeLessThanOrEqual(2);
  });

  it("shows 'Showing X of Y changes' when filtered", () => {
    useConfigurationChangeLedger.mockReturnValue({
      entries: sampleEntries,
      filter: "policy_updated",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => [sampleEntries[0]],
      setFilter: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleSortDirection: vi.fn(),
    });

    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getByText(/Showing 1 of 4 changes/i)).toBeInTheDocument();
  });

  it("renders empty state when no changes recorded", () => {
    useConfigurationChangeLedger.mockReturnValue({
      entries: [],
      filter: "all",
      searchQuery: "",
      sortDirection: "desc",
      getFilteredEntries: () => [],
      setFilter: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleSortDirection: vi.fn(),
    });

    render(<DashboardOrganizationConfigChangeLedger />);

    expect(screen.getByText(/No configuration changes recorded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Changes to company settings, payroll policy, and schema migrations will appear here/i)).toBeInTheDocument();
  });

  it("has accessible landmarks and headings", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    const section = screen.getByRole("region", { name: /Organization Configuration Change Ledger/i });
    expect(section).toBeInTheDocument();
  });

  it("displays relative time for recent changes", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    const relativeTimes = screen.getAllByText(/m ago|h ago|d ago|Just now/i);
    expect(relativeTimes.length).toBeGreaterThan(0);
  });

  it("shows different icons for different change types", () => {
    render(<DashboardOrganizationConfigChangeLedger />);

    const icons = screen.getAllByTestId("config-change-icon");
    expect(icons.length).toBeGreaterThan(0);
  });
});
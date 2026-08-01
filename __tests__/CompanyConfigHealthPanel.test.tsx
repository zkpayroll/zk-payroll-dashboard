import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyConfigHealthPanel } from "@/components/features/admin/CompanyConfigHealthPanel";
import type { CompanyConfig } from "@/types";

const VALID_STELLAR_1 = "G" + "A".repeat(55);
const VALID_STELLAR_2 = "G" + "B".repeat(55);
const VALID_CONTRACT = "C" + "A".repeat(55);

const validConfig: CompanyConfig = {
  id: "company_panel_test",
  name: "Panel Test Corp",
  admin: VALID_STELLAR_1,
  treasury: VALID_STELLAR_2,
  employeeCount: 10,
  isActive: true,
  network: "TESTNET",
  contracts: {
    registry: VALID_CONTRACT,
    commitment: VALID_CONTRACT,
    verifier: VALID_CONTRACT,
    executor: VALID_CONTRACT,
    audit: VALID_CONTRACT,
  },
  auditSettings: { enabled: true },
};

describe("CompanyConfigHealthPanel component", () => {
  it("renders the health check title and status banner for healthy config", () => {
    render(<CompanyConfigHealthPanel config={validConfig} />);

    expect(screen.getByRole("heading", { name: /Company Configuration Health/i })).toBeInTheDocument();
    expect(screen.getByText(/Healthy — All checks passed/i)).toBeInTheDocument();
    expect(screen.getByTestId("health-check-companySetup")).toBeInTheDocument();
    expect(screen.getByTestId("health-check-adminRole")).toBeInTheDocument();
    expect(screen.getByTestId("health-check-treasuryAccount")).toBeInTheDocument();
    expect(screen.getByTestId("health-check-contractIds")).toBeInTheDocument();
    expect(screen.getByTestId("health-check-networkConfig")).toBeInTheDocument();
    expect(screen.getByTestId("health-check-auditSettings")).toBeInTheDocument();
  });

  it("renders failing banner and error message when treasury account is invalid/missing", () => {
    const failingConfig: CompanyConfig = {
      ...validConfig,
      treasury: "",
    };

    render(<CompanyConfigHealthPanel config={failingConfig} />);

    expect(screen.getByText(/Failing — Action required/i)).toBeInTheDocument();
    expect(screen.getByText(/Treasury account not linked — go to Settings > Treasury./i)).toBeInTheDocument();
    expect(screen.getAllByText(/Fix in Settings/i).length).toBeGreaterThan(0);
  });

  it("renders warning banner when network is set to PUBLIC", () => {
    const warningConfig: CompanyConfig = {
      ...validConfig,
      network: "PUBLIC",
    };

    render(<CompanyConfigHealthPanel config={warningConfig} />);

    expect(screen.getByText(/Warning — Configuration review suggested/i)).toBeInTheDocument();
    expect(screen.getByText(/Network configuration targets Stellar Mainnet \(PUBLIC\)/i)).toBeInTheDocument();
  });
});

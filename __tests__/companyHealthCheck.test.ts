import { describe, it, expect } from "vitest";
import {
  checkCompanyHealth,
  isStellarAddress,
  isSorobanContractId,
} from "@/lib/companyHealthCheck";
import type { CompanyConfig } from "@/types";

const VALID_STELLAR_1 = "G" + "A".repeat(55);
const VALID_STELLAR_2 = "G" + "B".repeat(55);
const VALID_CONTRACT = "C" + "A".repeat(55);

const validContracts = {
  registry: VALID_CONTRACT,
  commitment: VALID_CONTRACT,
  verifier: VALID_CONTRACT,
  executor: VALID_CONTRACT,
  audit: VALID_CONTRACT,
};

const validConfig: CompanyConfig = {
  id: "company_test_1",
  name: "Test Corp",
  admin: VALID_STELLAR_1,
  treasury: VALID_STELLAR_2,
  employeeCount: 5,
  isActive: true,
  network: "TESTNET",
  contracts: validContracts,
  auditSettings: {
    enabled: true,
  },
};

describe("isStellarAddress and isSorobanContractId helpers", () => {
  it("validates Stellar public keys starting with G and 56 chars", () => {
    expect(isStellarAddress(VALID_STELLAR_1)).toBe(true);
    expect(isStellarAddress("INVALID")).toBe(false);
    expect(isStellarAddress(VALID_CONTRACT)).toBe(false);
    expect(isStellarAddress(undefined)).toBe(false);
  });

  it("validates Soroban contract IDs starting with C and 56 chars", () => {
    expect(isSorobanContractId(VALID_CONTRACT)).toBe(true);
    expect(isSorobanContractId(VALID_STELLAR_1)).toBe(false);
    expect(isSorobanContractId("INVALID")).toBe(false);
    expect(isSorobanContractId(undefined)).toBe(false);
  });
});

describe("checkCompanyHealth", () => {
  it("returns healthy overallStatus and all pass checks for a fully valid configuration", () => {
    const result = checkCompanyHealth(validConfig);
    expect(result.companyId).toBe("company_test_1");
    expect(result.overallStatus).toBe("healthy");
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every((c) => c.status === "pass")).toBe(true);
  });

  describe("Check 1: companySetup", () => {
    it("passes when company ID, name, and isActive are valid", () => {
      const result = checkCompanyHealth(validConfig);
      const check = result.checks.find((c) => c.key === "companySetup");
      expect(check?.status).toBe("pass");
    });

    it("fails when company name is missing", () => {
      const result = checkCompanyHealth({ ...validConfig, name: "" });
      const check = result.checks.find((c) => c.key === "companySetup");
      expect(check?.status).toBe("fail");
      expect(result.overallStatus).toBe("failing");
    });

    it("fails when company isActive is false", () => {
      const result = checkCompanyHealth({ ...validConfig, isActive: false });
      const check = result.checks.find((c) => c.key === "companySetup");
      expect(check?.status).toBe("fail");
      expect(result.overallStatus).toBe("failing");
    });
  });

  describe("Check 2: adminRole", () => {
    it("passes when admin is a valid Stellar address", () => {
      const result = checkCompanyHealth(validConfig);
      const check = result.checks.find((c) => c.key === "adminRole");
      expect(check?.status).toBe("pass");
    });

    it("fails when admin is missing", () => {
      const result = checkCompanyHealth({ ...validConfig, admin: "" });
      const check = result.checks.find((c) => c.key === "adminRole");
      expect(check?.status).toBe("fail");
      expect(result.overallStatus).toBe("failing");
    });

    it("fails when admin address format is invalid", () => {
      const result = checkCompanyHealth({ ...validConfig, admin: "G123SHORT" });
      const check = result.checks.find((c) => c.key === "adminRole");
      expect(check?.status).toBe("fail");
    });
  });

  describe("Check 3: treasuryAccount", () => {
    it("passes when treasury is set, valid Stellar address, and distinct from admin", () => {
      const result = checkCompanyHealth(validConfig);
      const check = result.checks.find((c) => c.key === "treasuryAccount");
      expect(check?.status).toBe("pass");
    });

    it("fails when treasury account is missing", () => {
      const result = checkCompanyHealth({ ...validConfig, treasury: "" });
      const check = result.checks.find((c) => c.key === "treasuryAccount");
      expect(check?.status).toBe("fail");
    });

    it("fails when treasury account equals admin address", () => {
      const result = checkCompanyHealth({ ...validConfig, treasury: VALID_STELLAR_1 });
      const check = result.checks.find((c) => c.key === "treasuryAccount");
      expect(check?.status).toBe("fail");
      expect(check?.message).toContain("must be distinct from admin");
    });
  });

  describe("Check 4: contractIds", () => {
    it("passes when all required contract IDs are valid Soroban IDs", () => {
      const result = checkCompanyHealth(validConfig);
      const check = result.checks.find((c) => c.key === "contractIds");
      expect(check?.status).toBe("pass");
    });

    it("fails when a required contract ID is missing or invalid", () => {
      const result = checkCompanyHealth({
        ...validConfig,
        contracts: { ...validContracts, registry: "INVALID" },
      });
      const check = result.checks.find((c) => c.key === "contractIds");
      expect(check?.status).toBe("fail");
    });
  });

  describe("Check 5: networkConfig", () => {
    it("passes when network is TESTNET", () => {
      const result = checkCompanyHealth({ ...validConfig, network: "TESTNET" });
      const check = result.checks.find((c) => c.key === "networkConfig");
      expect(check?.status).toBe("pass");
    });

    it("returns warning when network is PUBLIC (Mainnet)", () => {
      const result = checkCompanyHealth({ ...validConfig, network: "PUBLIC" });
      const check = result.checks.find((c) => c.key === "networkConfig");
      expect(check?.status).toBe("warning");
      expect(result.overallStatus).toBe("warning");
    });

    it("fails when network is invalid", () => {
      const result = checkCompanyHealth({ ...validConfig, network: "DEVNET" as any });
      const check = result.checks.find((c) => c.key === "networkConfig");
      expect(check?.status).toBe("fail");
      expect(result.overallStatus).toBe("failing");
    });
  });

  describe("Check 6: auditSettings", () => {
    it("passes when audit contract is set and auditSettings enabled", () => {
      const result = checkCompanyHealth(validConfig);
      const check = result.checks.find((c) => c.key === "auditSettings");
      expect(check?.status).toBe("pass");
    });

    it("returns warning when audit contract is set but auditSettings.enabled is false", () => {
      const result = checkCompanyHealth({
        ...validConfig,
        auditSettings: { enabled: false },
      });
      const check = result.checks.find((c) => c.key === "auditSettings");
      expect(check?.status).toBe("warning");
    });

    it("fails when audit contract ID is missing or invalid", () => {
      const result = checkCompanyHealth({
        ...validConfig,
        contracts: { ...validContracts, audit: "" },
      });
      const check = result.checks.find((c) => c.key === "auditSettings");
      expect(check?.status).toBe("fail");
    });
  });

  describe("Overall Status Aggregation Logic", () => {
    it("aggregates to failing if any single check fails", () => {
      const result = checkCompanyHealth({
        ...validConfig,
        network: "PUBLIC", // warning
        treasury: "", // fail
      });
      expect(result.overallStatus).toBe("failing");
    });

    it("aggregates to warning if no fail check exists but at least one warning exists", () => {
      const result = checkCompanyHealth({
        ...validConfig,
        network: "PUBLIC", // warning
      });
      expect(result.overallStatus).toBe("warning");
    });
  });
});

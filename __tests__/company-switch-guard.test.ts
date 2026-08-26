import { describe, it, expect } from "vitest";
import { evaluateCompanySwitch } from "@/lib/company/companySwitchGuard";
import type { Company } from "@/types/models";

const activeCompany: Company = {
  id: "company_active",
  name: "Active Co",
  admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  employeeCount: 2,
  isActive: true,
};

const inactiveCompany: Company = {
  ...activeCompany,
  id: "company_inactive",
  name: "Inactive Co",
  isActive: false,
};

const invalidAdminCompany: Company = {
  ...activeCompany,
  id: "company_invalid_admin",
  name: "Invalid Admin Co",
  admin: "not-a-valid-stellar-address",
};

describe("evaluateCompanySwitch", () => {
  it("blocks non-admin roles from switching", () => {
    const result = evaluateCompanySwitch(activeCompany, "operator");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not-admin");
  });

  it("blocks switching into an inactive company", () => {
    const result = evaluateCompanySwitch(inactiveCompany, "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("company-inactive");
  });

  it("blocks switching into a company with an invalid admin address", () => {
    const result = evaluateCompanySwitch(invalidAdminCompany, "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("invalid-admin-address");
  });

  it("blocks switching when the connected wallet does not match the target admin", () => {
    const result = evaluateCompanySwitch(activeCompany, "admin", "GSOMEOTHERWALLETADDRESS");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unauthorized-admin");
  });

  it("allows switching when the connected wallet matches the target admin", () => {
    const result = evaluateCompanySwitch(activeCompany, "admin", activeCompany.admin);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("allows switching when no wallet key is supplied (authorization check skipped)", () => {
    const result = evaluateCompanySwitch(activeCompany, "admin");
    expect(result.allowed).toBe(true);
  });
});

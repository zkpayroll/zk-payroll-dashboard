import { beforeEach, describe, expect, it } from "vitest";
import { useCompanyStore } from "@/stores/company";
import {
  configurationSnapshot,
  MAX_CONFIGURATION_REVISIONS,
  type CompanyConfiguration,
} from "@/lib/company/configurationRevision";

const company: CompanyConfiguration = {
  id: "company-a",
  name: "Example Company",
  admin: "G" + "A".repeat(55),
  treasury: "G" + "B".repeat(55),
  employeeCount: 2,
  isActive: true,
};
const fullConfig: CompanyConfiguration = {
  ...company,
  network: "TESTNET",
  contracts: {
    registry: "C" + "A".repeat(55),
    commitment: "C" + "B".repeat(55),
    verifier: "C" + "C".repeat(55),
    executor: "C" + "D".repeat(55),
    audit: "C" + "E".repeat(55),
  },
  auditSettings: {
    enabled: true,
    retentionDays: 365,
    requireAuditorApproval: false,
  },
};
const state = () => useCompanyStore.getState();
beforeEach(() => {
  localStorage.clear();
  useCompanyStore.setState({
    company: null,
    configurationSnapshots: {},
    configurationRevisions: {},
    isLoading: false,
  });
});

describe("company configuration revision tracking", () => {
  it("records a baseline for the existing setup setter", () => {
    state().setCompany(company);
    expect(state().configurationRevisions[company.id]).toEqual([
      expect.objectContaining({
        id: "company-a:1",
        companyId: company.id,
        version: 1,
        kind: "baseline",
        changedFields: expect.arrayContaining(["name", "admin", "treasury"]),
      }),
    ]);
    expect(
      Number.isNaN(
        Date.parse(state().configurationRevisions[company.id][0].timestamp),
      ),
    ).toBe(false);
  });
  it("tracks real edits without mutating the previous history", () => {
    state().setCompany(company);
    const original = state().configurationRevisions[company.id];
    state().setCompany({ ...company, name: "New Name" });
    expect(state().configurationRevisions[company.id][0]).toMatchObject({
      version: 2,
      kind: "updated",
      changedFields: ["name"],
    });
    expect(original).toHaveLength(1);
  });
  it("ignores employee counts, object key order", () => {
    state().setCompany(fullConfig);
    const original = state().configurationRevisions[company.id];
    state().setCompany({
      ...fullConfig,
      employeeCount: 99,
      tokenContractId: "",
      contracts: { ...fullConfig.contracts! },
    });
    expect(state().company?.employeeCount).toBe(99);
    expect(state().configurationRevisions[company.id]).toBe(original);
  });
  it("detects nested changes and removal of optional configuration", () => {
    state().setCompany(fullConfig);
    state().setCompany({
      ...fullConfig,
      contracts: { ...fullConfig.contracts!, executor: "C" + "F".repeat(55) },
      auditSettings: {
        enabled: true,
        retentionDays: 30,
        requireAuditorApproval: false,
      },
    });
    expect(state().configurationRevisions[company.id][0].changedFields).toEqual(
      ["contracts.executor", "auditSettings.retentionDays"],
    );
    state().setCompany(company);
    expect(
      state().configurationRevisions[company.id][0].changedFields,
    ).toContain("contracts.executor");
  });
  it("keeps company histories separate and does not turn switches into edits", () => {
    state().setCompany(fullConfig);
    const aHistory = state().configurationRevisions[company.id];
    const other = { ...company, id: "company-b" };
    expect(state().switchCompany(other, "admin", other.admin).allowed).toBe(
      true,
    );
    expect(state().switchCompany(company, "admin", company.admin).allowed).toBe(
      true,
    );
    expect(state().configurationRevisions[company.id]).toBe(aHistory);
    expect(state().configurationRevisions[other.id][0].version).toBe(1);
  });
  it("does not record rejected company switches", () => {
    state().setCompany(company);
    const original = state().configurationRevisions;
    expect(
      state().switchCompany(
        { ...company, id: "blocked", isActive: false },
        "admin",
      ).allowed,
    ).toBe(false);
    expect(state().configurationRevisions).toBe(original);
  });
  it("retains history across clearing the active company without inventing a revision", () => {
    state().setCompany(company);
    const original = state().configurationRevisions;
    state().clearCompany();
    expect(state().company).toBeNull();
    state().setCompany(company);
    expect(state().configurationRevisions).toBe(original);
  });
  it("bounds retained history without resetting the version counter", () => {
    state().setCompany(company);
    for (let i = 1; i <= MAX_CONFIGURATION_REVISIONS + 2; i++)
      state().setCompany({ ...company, name: `Company ${i}` });
    const history = state().configurationRevisions[company.id];
    expect(history).toHaveLength(MAX_CONFIGURATION_REVISIONS);
    expect(history[0].version).toBe(MAX_CONFIGURATION_REVISIONS + 3);
    expect(new Set(history.map((revision) => revision.id)).size).toBe(
      MAX_CONFIGURATION_REVISIONS,
    );
  });
  it("stores revision metadata without raw configuration or arbitrary payroll fields", () => {
    const input = {
      ...fullConfig,
      salary: 999999,
      secret: "must-not-retain",
      auditSettings: {
        ...fullConfig.auditSettings!,
        privateKey: "never-store",
      },
    };
    state().setCompany(input);
    const history = JSON.stringify(state().configurationRevisions);
    expect(history).not.toContain(company.admin);
    expect(history).not.toContain(fullConfig.contracts!.registry);
    expect(history).not.toContain("must-not-retain");
    expect(JSON.stringify(configurationSnapshot(input))).not.toContain(
      "never-store",
    );
    expect(Object.keys(configurationSnapshot(input))).not.toContain("salary");
  });
  it("detaches snapshots from later caller mutation", () => {
    const input = { ...fullConfig, contracts: { ...fullConfig.contracts! } };
    state().setCompany(input);
    input.contracts.executor = "C" + "F".repeat(55);
    state().setCompany(input);
    expect(state().configurationRevisions[company.id][0]).toMatchObject({
      version: 2,
      changedFields: ["contracts.executor"],
    });
  });
  it("persists and rehydrates histories with the company", async () => {
    state().setCompany(company);
    state().setCompany({ ...company, name: "Persisted Name" });
    const serialized = localStorage.getItem("zk-payroll-company")!;
    useCompanyStore.setState({
      company: null,
      configurationSnapshots: {},
      configurationRevisions: {},
    });
    localStorage.setItem("zk-payroll-company", serialized);
    await useCompanyStore.persist.rehydrate();
    expect(state().company?.name).toBe("Persisted Name");
    expect(state().configurationRevisions[company.id][0].version).toBe(2);
  });
  it("hydrates legacy company-only storage without fabricating historical timestamps", async () => {
    localStorage.setItem(
      "zk-payroll-company",
      JSON.stringify({ state: { company }, version: 0 }),
    );
    await useCompanyStore.persist.rehydrate();
    expect(state().company?.id).toBe(company.id);
    expect(state().configurationRevisions).toEqual({});
    state().setCompany(company);
    expect(state().configurationRevisions[company.id][0].kind).toBe("baseline");
  });
});

describe("validated configuration edits", () => {
  beforeEach(() => state().setCompany(company));
  it("saves a validated edit and returns the next revision", () => {
    expect(
      state().updateConfiguration({ ...fullConfig, name: "Updated" }, 1),
    ).toEqual({ ok: true, version: 2 });
    expect(state().company?.name).toBe("Updated");
  });
  it("does not overwrite an operational employee count from an older configuration draft", () => {
    state().setCompany({ ...company, employeeCount: 99 });
    expect(
      state().updateConfiguration({ ...company, name: "New config name" }, 1)
        .ok,
    ).toBe(true);
    expect(state().company?.employeeCount).toBe(99);
  });
  it("establishes revision one when editing a legacy company without history", () => {
    useCompanyStore.setState({
      company,
      configurationSnapshots: {},
      configurationRevisions: {},
    });
    expect(
      state().updateConfiguration({ ...company, name: "Edited legacy" }, 0),
    ).toEqual({ ok: true, version: 1 });
  });
  it("rejects whitespace-padded legacy IDs without rewriting company identity", () => {
    const legacy = { ...company, id: " company-a " };
    state().setCompany(legacy);
    expect(state().updateConfiguration(legacy, 1)).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(state().company?.id).toBe(legacy.id);
  });
  it("does not increment a revision for a no-op save", () => {
    expect(state().updateConfiguration({ ...company }, 1)).toEqual({
      ok: true,
      version: 1,
    });
  });
  it("rejects a stale edit without overwriting a successful save", () => {
    state().updateConfiguration({ ...company, name: "First editor" }, 1);
    expect(
      state().updateConfiguration({ ...company, name: "Stale editor" }, 1),
    ).toMatchObject({
      ok: false,
      code: "conflict",
      message: expect.stringContaining("Reload"),
    });
    expect(state().company?.name).toBe("First editor");
    expect(state().configurationRevisions[company.id]).toHaveLength(2);
  });
  it.each([-1, NaN, 1.5, Infinity])(
    "rejects an invalid expected revision %s",
    (revision) => {
      expect(state().updateConfiguration(company, revision)).toMatchObject({
        ok: false,
        code: "conflict",
      });
    },
  );
  it("rejects edits targeting a different active company", () => {
    expect(
      state().updateConfiguration({ ...company, id: "another-company" }, 1),
    ).toMatchObject({ ok: false, code: "conflict" });
    expect(state().company?.id).toBe(company.id);
  });
  it.each([
    { name: " " },
    { admin: "invalid" },
    { treasury: company.admin },
    { network: "PUBLIC" as const },
    { contracts: fullConfig.contracts },
    {
      ...fullConfig,
      contracts: { ...fullConfig.contracts!, executor: "invalid" },
    },
    { auditSettings: { enabled: true, retentionDays: -1 } },
  ])("rejects invalid configuration without changing state: %j", (changes) => {
    const before = state().configurationRevisions;
    expect(
      state().updateConfiguration({ ...company, ...changes }, 1),
    ).toMatchObject({
      ok: false,
      code: "invalid",
      message: expect.any(String),
    });
    expect(state().configurationRevisions).toBe(before);
    expect(state().company).toEqual(company);
  });
  it("saves valid incomplete setup profiles without requiring undeployed contracts", () => {
    expect(
      state().updateConfiguration({ ...company, name: "Valid setup" }, 1).ok,
    ).toBe(true);
  });
});

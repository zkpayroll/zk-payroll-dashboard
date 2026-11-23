import { describe, it, expect } from "vitest";
import {
  MAX_SETTINGS_VALIDATION_HISTORY,
  getSettingsValidationHistoryStats,
  recordSettingsValidation,
  type SettingsValidationHistory,
} from "@/src/settings/validationHistory";
import { validateCompanyConfig } from "@/lib/validateCompanyConfig";
import type { CompanyConfig } from "@/types";

const VALID_STELLAR_ADMIN = "G" + "A".repeat(55);
const VALID_STELLAR_TREASURY = "G" + "B".repeat(55);
const VALID_CONTRACT = "C" + "A".repeat(55);

const validConfig: CompanyConfig = {
  id: "company_validation_history_test",
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

const FIXED_NOW = new Date("2026-10-21T12:00:00.000Z");

describe("recordSettingsValidation", () => {
  it("records a passing validation run as the newest history entry", () => {
    const validation = validateCompanyConfig(validConfig);

    const result = recordSettingsValidation([], validation, {
      companyId: validConfig.id,
      now: () => FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entry.status).toBe("passed");
    expect(result.entry.errorCount).toBe(0);
    expect(result.entry.warningCount).toBe(0);
    expect(result.entry.companyId).toBe("company_validation_history_test");
    expect(result.entry.validatedAt).toBe("2026-10-21T12:00:00.000Z");
    expect(result.entry.failedChecks).toEqual([]);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toEqual(result.entry);
  });

  it("records a failing validation run with actionable failed-check messages", () => {
    const brokenConfig: CompanyConfig = { ...validConfig, admin: "", treasury: "" };
    const validation = validateCompanyConfig(brokenConfig);

    const result = recordSettingsValidation([], validation, {
      companyId: brokenConfig.id,
      now: () => FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entry.status).toBe("failed");
    expect(result.entry.errorCount).toBeGreaterThanOrEqual(2);
    expect(result.entry.failedChecks.map((check) => check.message)).toContain(
      "Admin address is not set.",
    );
    expect(result.entry.failedChecks.map((check) => check.message)).toContain(
      "Treasury address is not set.",
    );
  });

  it("prepends each new entry while preserving earlier runs", () => {
    const validation = validateCompanyConfig(validConfig);
    const first = recordSettingsValidation([], validation, { now: () => FIXED_NOW });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = recordSettingsValidation(first.history, validation, {
      companyId: validConfig.id,
      now: () => new Date("2026-10-21T13:00:00.000Z"),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.history).toHaveLength(2);
    expect(second.history[0].validatedAt).toBe("2026-10-21T13:00:00.000Z");
    expect(second.history[1]).toEqual(first.entry);
  });

  it("rejects a validation result without a checks list with an actionable error", () => {
    const result = recordSettingsValidation([], { valid: false } as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("failed:");
    expect(result.error).toContain("missing its checks list");
    expect(result.error).toContain("Re-run organization settings validation");
  });

  it("rejects a malformed history value with an actionable error", () => {
    const validation = validateCompanyConfig(validConfig);
    const result = recordSettingsValidation("not-a-list" as never, validation);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("failed:");
    expect(result.error).toContain("Reload the settings page");
  });

  it("rejects a malformed validation check with an actionable error", () => {
    const result = recordSettingsValidation([], {
      valid: true,
      checks: [{ id: "network-known", label: "Network", status: "surprise" }],
    } as never);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("malformed");
    expect(result.error).toContain("Re-run organization settings validation");
  });

  it("rejects an invalid validation clock with an actionable error", () => {
    const validation = validateCompanyConfig(validConfig);
    const result = recordSettingsValidation([], validation, {
      now: () => new Date("not-a-date"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("timestamp is invalid");
    expect(result.error).toContain("Check the system clock");
  });

  it("keeps only the newest entries once the retention cap is reached", () => {
    const validation = validateCompanyConfig(validConfig);
    let history: SettingsValidationHistory = [];

    for (let i = 0; i < MAX_SETTINGS_VALIDATION_HISTORY + 5; i++) {
      const result = recordSettingsValidation(history, validation, {
        companyId: validConfig.id,
        now: () => new Date(Date.UTC(2026, 9, 21, 12, 0, i)),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      history = result.history;
    }

    expect(history).toHaveLength(MAX_SETTINGS_VALIDATION_HISTORY);
    expect(history[0].validatedAt).toBe("2026-10-21T12:00:54.000Z");
    expect(history[history.length - 1].validatedAt).toBe("2026-10-21T12:00:05.000Z");
  });

  it("never stores addresses or salary data in recorded entries", () => {
    const brokenConfig: CompanyConfig = { ...validConfig, admin: "" };
    const validation = validateCompanyConfig(brokenConfig);

    const result = recordSettingsValidation([], validation, {
      companyId: brokenConfig.id,
      now: () => FIXED_NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const serialized = JSON.stringify(result.history);
    expect(serialized).not.toContain(VALID_STELLAR_TREASURY);
    expect(serialized).not.toContain("salary");
    expect(serialized).not.toContain("salaryCommitment");
  });
});

describe("getSettingsValidationHistoryStats", () => {
  it("returns zeroed stats for an empty history", () => {
    expect(getSettingsValidationHistoryStats([])).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      lastValidatedAt: null,
      lastStatus: null,
    });
  });

  it("aggregates passed and failed runs with the latest status", () => {
    const passed = recordSettingsValidation([], validateCompanyConfig(validConfig), {
      now: () => FIXED_NOW,
    });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;

    const failed = recordSettingsValidation(
      passed.history,
      validateCompanyConfig({ ...validConfig, admin: "" }),
      { now: () => new Date("2026-10-21T14:00:00.000Z") },
    );
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;

    expect(getSettingsValidationHistoryStats(failed.history)).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      lastValidatedAt: "2026-10-21T14:00:00.000Z",
      lastStatus: "failed",
    });
  });
});

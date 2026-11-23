import { describe, expect, it } from "vitest";
import {
  buildExportPreviewFields,
  evaluateExportReviewGate,
  formatExportPreviewText,
  isSensitiveExportField,
  summarizeExportRedaction,
  type ExportScopeSummary,
} from "@/src/exports/reviewGate";
import {
  SIGNED_OUT_EXPORT_REASON,
  resolveExportAccess,
} from "@/src/permissions/exportAccess";

function scope(overrides: Partial<ExportScopeSummary> = {}): ExportScopeSummary {
  return {
    permissionKey: "payroll-history",
    title: "Payroll history CSV",
    scope: "Payroll runs",
    format: "CSV",
    fields: ["run id", "date", "status"],
    privacyNotice: "Individual salaries and wallets are not included.",
    recordCount: 5,
    ...overrides,
  };
}

describe("resolveExportAccess", () => {
  it("allows a role that holds the export permission", () => {
    const access = resolveExportAccess("admin", "payroll-history");

    expect(access.allowed).toBe(true);
    expect(access.role).toBe("admin");
    expect(access.roleLabel).toBe("Admin");
    expect(access.reason).toBeNull();
  });

  it("blocks a signed out user with a sign-in prompt", () => {
    const access = resolveExportAccess(null, "payroll-history");

    expect(access.allowed).toBe(false);
    expect(access.role).toBeNull();
    expect(access.roleLabel).toBeNull();
    expect(access.reason).toBe(SIGNED_OUT_EXPORT_REASON);
  });

  it("explains a role-based restriction", () => {
    const access = resolveExportAccess("auditor", "payroll-history");

    expect(access.allowed).toBe(false);
    expect(access.roleLabel).toBe("Auditor");
    expect(access.reason).toBe(
      "Auditor access is limited to compliance and audit-ledger exports only.",
    );
  });

  it("blocks an unknown export key", () => {
    const access = resolveExportAccess("admin", "does-not-exist");

    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("Export not available for your role.");
  });
});

describe("isSensitiveExportField", () => {
  it("flags salary, wallet, and contact fields", () => {
    expect(isSensitiveExportField("salary")).toBe(true);
    expect(isSensitiveExportField("Salary Commitment")).toBe(true);
    expect(isSensitiveExportField("total compensation")).toBe(true);
    expect(isSensitiveExportField("wallet address")).toBe(true);
    expect(isSensitiveExportField("employee email")).toBe(true);
    expect(isSensitiveExportField("phone number")).toBe(true);
    expect(isSensitiveExportField("ssn")).toBe(true);
  });

  it("leaves operational fields alone", () => {
    expect(isSensitiveExportField("run id")).toBe(false);
    expect(isSensitiveExportField("department")).toBe(false);
    expect(isSensitiveExportField("employee id")).toBe(false);
    expect(isSensitiveExportField("status")).toBe(false);
  });
});

describe("summarizeExportRedaction", () => {
  it("reports no redaction when the scope has no sensitive fields", () => {
    const summary = summarizeExportRedaction(["run id", "date", "status"]);

    expect(summary.level).toBe("none");
    expect(summary.label).toBe("No redaction");
    expect(summary.totalFields).toBe(3);
    expect(summary.sensitiveFields).toHaveLength(0);
    expect(summary.retainedSensitiveFields).toHaveLength(0);
    expect(summary.description).toContain("no personal salary, wallet, or contact fields");
  });

  it("reports full redaction when every sensitive field is redacted", () => {
    const summary = summarizeExportRedaction(
      ["employee id", "department", "salary commitment"],
      ["SALARY COMMITMENT"],
    );

    expect(summary.level).toBe("full");
    expect(summary.label).toBe("Fully redacted");
    expect(summary.sensitiveFields).toEqual(["salary commitment"]);
    expect(summary.redactedFields).toEqual(["salary commitment"]);
    expect(summary.retainedSensitiveFields).toHaveLength(0);
    expect(summary.description).toBe("All sensitive fields are redacted before download.");
  });

  it("reports partial redaction when only some sensitive fields are redacted", () => {
    const summary = summarizeExportRedaction(
      ["employee id", "salary", "wallet address"],
      ["salary"],
    );

    expect(summary.level).toBe("partial");
    expect(summary.retainedSensitiveFields).toEqual(["wallet address"]);
    expect(summary.description).toContain("Some sensitive fields are redacted");
  });

  it("reports no redaction when sensitive fields are left in plain sight", () => {
    const summary = summarizeExportRedaction(["salary", "wallet address"], []);

    expect(summary.level).toBe("none");
    expect(summary.retainedSensitiveFields).toEqual(["salary", "wallet address"]);
    expect(summary.description).toContain("included without redaction");
  });

  it("ignores redaction entries that are not part of the scope", () => {
    const summary = summarizeExportRedaction(["department"], ["ghost field"]);

    expect(summary.redactedFields).toHaveLength(0);
    expect(summary.level).toBe("none");
  });

  it("handles an empty field list", () => {
    const summary = summarizeExportRedaction([]);

    expect(summary.totalFields).toBe(0);
    expect(summary.level).toBe("none");
    expect(summary.label).toBe("No redaction");
  });
});

describe("evaluateExportReviewGate", () => {
  it("lets an authorized export proceed", () => {
    const redaction = summarizeExportRedaction(["run id", "date", "status"]);
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope(),
      redaction,
    });

    expect(result.canProceed).toBe(true);
    expect(result.blockedReasons).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.access.allowed).toBe(true);
    expect(result.scopeLine).toBe("Payroll runs · CSV · 3 fields · 5 records");
    expect(result.redactionLine).toBe(
      "No redaction. This export includes no personal salary, wallet, or contact fields.",
    );
  });

  it("blocks a restricted role with the permission reason", () => {
    const result = evaluateExportReviewGate({
      role: "auditor",
      scope: scope(),
      redaction: summarizeExportRedaction(["run id"]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.access.allowed).toBe(false);
    expect(result.blockedReasons).toEqual([
      "Auditor access is limited to compliance and audit-ledger exports only.",
    ]);
  });

  it("blocks a signed out user", () => {
    const result = evaluateExportReviewGate({
      role: null,
      scope: scope(),
      redaction: summarizeExportRedaction(["run id"]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockedReasons).toContain(SIGNED_OUT_EXPORT_REASON);
  });

  it("blocks an export with an empty field scope", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({ fields: [] }),
      redaction: summarizeExportRedaction([]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockedReasons).toContain(
      "The export scope is empty, so there is nothing to download. Select records and try again.",
    );
  });

  it("blocks an export with no matching records", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({ recordCount: 0 }),
      redaction: summarizeExportRedaction(["run id"]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockedReasons).toContain(
      "No records match the current export scope. Adjust the selection and try again.",
    );
  });

  it("omits the record segment when no record count is known", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({ recordCount: undefined }),
      redaction: summarizeExportRedaction(["run id"]),
    });

    expect(result.scopeLine).toBe("Payroll runs · CSV · 3 fields");
    expect(result.canProceed).toBe(true);
  });

  it("warns when sensitive fields survive redaction", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({
        permissionKey: "employee-directory",
        fields: ["employee id", "salary commitment"],
        recordCount: 12,
      }),
      redaction: summarizeExportRedaction(["employee id", "salary commitment"], []),
    });

    expect(result.canProceed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Included sensitive fields: salary commitment");
    expect(result.warnings[0]).toContain("Confirm these are permitted");
  });

  it("blocks an export key the role map does not recognize", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({ permissionKey: "mystery-export" }),
      redaction: summarizeExportRedaction(["run id"]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockedReasons).toContain("Export not available for your role.");
  });

  it("survives a scope whose field list is unusable", () => {
    const result = evaluateExportReviewGate({
      role: "admin",
      scope: scope({ fields: undefined as unknown as string[] }),
      redaction: summarizeExportRedaction([]),
    });

    expect(result.canProceed).toBe(false);
    expect(result.blockedReasons).toContain(
      "The export scope is empty, so there is nothing to download. Select records and try again.",
    );
  });
});

describe("export preview field rendering", () => {
  it("marks redacted and included fields without exposing any values", () => {
    const scopeSummary = scope({
      fields: ["employee id", "salary commitment", "department"],
      recordCount: 3,
    });
    const redaction = summarizeExportRedaction(
      scopeSummary.fields,
      ["salary commitment"],
    );

    const preview = buildExportPreviewFields(scopeSummary, redaction);
    expect(preview).toEqual([
      { field: "employee id", sensitive: false, redacted: false },
      { field: "salary commitment", sensitive: true, redacted: true },
      { field: "department", sensitive: false, redacted: false },
    ]);

    const text = formatExportPreviewText(preview);
    expect(text).toBe(
      "employee id: INCLUDED\nsalary commitment: REDACTED\ndepartment: INCLUDED",
    );
    expect(text).not.toContain("$");
    expect(text).not.toMatch(/\d{4,}/);
  });

  it("returns an empty preview for an empty scope", () => {
    const scopeSummary = scope({ fields: [] });
    const preview = buildExportPreviewFields(
      scopeSummary,
      summarizeExportRedaction([]),
    );

    expect(preview).toHaveLength(0);
    expect(formatExportPreviewText(preview)).toBe("");
  });
});

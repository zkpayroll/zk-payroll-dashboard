/**
 * @vitest-environment jsdom
 *
 * Tests for the export review gate (issue #270): the scope, redaction, and
 * access checks shown before an export download starts, plus its integration
 * with the Export Center.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExportReviewGate from "@/components/features/exports/ExportReviewGate";
import ExportCenter from "@/components/features/exports/ExportCenter";
import {
  summarizeExportRedaction,
  type ExportScopeSummary,
} from "@/src/exports/reviewGate";

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ExportReviewGate", () => {
  it("lets an authorized export proceed after review", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ExportReviewGate
        isOpen
        role="admin"
        scope={scope()}
        redaction={summarizeExportRedaction(["run id", "date", "status"])}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const scopeSection = screen.getByTestId("export-review-scope");
    expect(scopeSection).toHaveTextContent("Payroll runs · CSV · 3 fields · 5 records");
    expect(scopeSection).toHaveTextContent(
      "Individual salaries and wallets are not included.",
    );

    expect(screen.getByTestId("export-review-redaction")).toHaveTextContent("No redaction");
    expect(screen.getByTestId("export-review-access")).toHaveTextContent(
      "Allowed for Admin role.",
    );

    expect(screen.queryByTestId("export-review-blocked")).not.toBeInTheDocument();

    const confirm = screen.getByTestId("export-review-confirm");
    expect(confirm).toBeEnabled();
    expect(confirm).toHaveTextContent("Confirm & download");

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("blocks a restricted role and disables the download", () => {
    const onConfirm = vi.fn();

    render(
      <ExportReviewGate
        isOpen
        role="auditor"
        scope={scope()}
        redaction={summarizeExportRedaction(["run id", "date", "status"])}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const blocked = screen.getByTestId("export-review-blocked");
    expect(blocked).toHaveAttribute("role", "alert");
    expect(blocked).toHaveTextContent("Export blocked");
    expect(blocked).toHaveTextContent(
      "Auditor access is limited to compliance and audit-ledger exports only.",
    );
    expect(screen.getByTestId("export-review-access")).toHaveTextContent(
      "Auditor access is limited to compliance and audit-ledger exports only.",
    );

    const confirm = screen.getByTestId("export-review-confirm");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent("Export blocked");

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks a signed out user", () => {
    render(
      <ExportReviewGate
        isOpen
        role={null}
        scope={scope()}
        redaction={summarizeExportRedaction(["run id"])}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("export-review-blocked")).toHaveTextContent(
      "Sign in to review and download this export.",
    );
    expect(screen.getByTestId("export-review-confirm")).toBeDisabled();
  });

  it("blocks an empty export scope", () => {
    render(
      <ExportReviewGate
        isOpen
        role="admin"
        scope={scope({ fields: [], recordCount: 0 })}
        redaction={summarizeExportRedaction([])}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const blocked = screen.getByTestId("export-review-blocked");
    expect(blocked).toHaveTextContent(
      "The export scope is empty, so there is nothing to download.",
    );
    expect(blocked).toHaveTextContent(
      "No records match the current export scope.",
    );
    expect(screen.getByTestId("export-review-confirm")).toBeDisabled();
  });

  it("warns about sensitive fields that stay in the export", () => {
    render(
      <ExportReviewGate
        isOpen
        role="admin"
        scope={scope({
          permissionKey: "employee-directory",
          fields: ["employee id", "salary commitment"],
        })}
        redaction={summarizeExportRedaction(
          ["employee id", "salary commitment"],
          [],
        )}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const warnings = screen.getByTestId("export-review-warnings");
    expect(warnings).toHaveTextContent("Included sensitive fields: salary commitment");
    expect(screen.getByTestId("export-review-redaction")).toHaveTextContent(
      "Sensitive fields are included without redaction.",
    );
    expect(screen.getByTestId("export-review-confirm")).toBeEnabled();
  });

  it("renders only field names in the preview, never values", () => {
    const fields = ["salary commitment", "wallet address", "department"];
    render(
      <ExportReviewGate
        isOpen
        role="admin"
        scope={scope({ fields, recordCount: 12 })}
        redaction={summarizeExportRedaction(fields, ["salary commitment"])}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const preview = screen.getByTestId("export-review-preview");
    expect(preview).toHaveTextContent("Preview (field names only — no values)");
    expect(preview).toHaveTextContent("salary commitment");
    expect(preview).toHaveTextContent("wallet address");
    expect(preview).toHaveTextContent("REDACTED");
    expect(preview).toHaveTextContent("INCLUDED");
    expect(preview.textContent ?? "").not.toContain("$");
    expect(preview.textContent ?? "").not.toMatch(/\d{3,}/);
    expect(screen.getByTestId("export-review-redaction")).toHaveTextContent(
      "Partially redacted",
    );
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ExportReviewGate
        isOpen={false}
        role="admin"
        scope={scope()}
        redaction={summarizeExportRedaction(["run id"])}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("export-review-gate")).not.toBeInTheDocument();
  });
});

describe("ExportCenter integration", () => {
  function stubDownload() {
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    return { createObjectURL, revokeObjectURL, clickSpy };
  }

  function stubSession(role: string) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("opens the review gate instead of downloading immediately", async () => {
    stubDownload();
    stubSession("admin");
    const user = userEvent.setup();

    render(<ExportCenter />);

    const request = await screen.findByTestId("export-request-payroll-history");
    await user.click(request);

    expect(await screen.findByTestId("export-review-gate")).toBeInTheDocument();
    expect(screen.getByTestId("export-review-scope")).toHaveTextContent(
      "Payroll runs · CSV · 6 fields · 5 records",
    );
    expect(screen.getByTestId("export-review-access")).toHaveTextContent(
      "Allowed for Admin role.",
    );

    await user.click(screen.getByTestId("export-review-confirm"));

    await waitFor(() =>
      expect(screen.queryByTestId("export-review-gate")).not.toBeInTheDocument(),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("cancelling the review does not start the download", async () => {
    stubDownload();
    stubSession("admin");
    const user = userEvent.setup();

    render(<ExportCenter />);

    await user.click(await screen.findByTestId("export-request-payroll-history"));
    await screen.findByTestId("export-review-gate");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("export-review-gate")).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("locks exports the role cannot access before any gate appears", async () => {
    stubDownload();
    stubSession("auditor");

    render(<ExportCenter />);

    await screen.findByText(/Signed in as/);
    expect(screen.queryByTestId("export-request-payroll-history")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Auditor access is limited to compliance and audit-ledger exports only.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("still opens the gate for an export the role is allowed to download", async () => {
    stubDownload();
    stubSession("auditor");
    const user = userEvent.setup();

    render(<ExportCenter />);

    await user.click(await screen.findByTestId("export-request-audit-requests"));

    expect(await screen.findByTestId("export-review-gate")).toBeInTheDocument();
    expect(screen.getByTestId("export-review-access")).toHaveTextContent(
      "Allowed for Auditor role.",
    );
  });
});

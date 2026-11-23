import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AuditGrantScopeDetailsDrawer,
  type AuditGrantDetail,
} from "@/components/features/audit/AuditGrantScopeDetailsDrawer";
import {
  AuditGrantRevocationStatus,
  formatRevocationTimestamp,
  isAuditGrantRevoked,
} from "@/components/features/audit/AuditGrantRevocationStatus";
import AuditGrantsPage, { MOCK_AUDIT_GRANTS } from "@/app/audit/page";

const createActiveGrant = (): AuditGrantDetail => ({
  id: "grant_active_001",
  auditorName: "Alpha Security Audit",
  auditorOrg: "Alpha Security Partners",
  auditorAddress: "0x1111222233334444555566667777888899990000",
  grantedBy: "Operator Admin",
  createdAt: "2026-09-01T10:00:00Z",
  expiresAt: "2026-12-01T10:00:00Z",
  status: "active",
  maskingTier: "FULL_ZERO_KNOWLEDGE",
  accessibleScopes: [
    {
      id: "scope_verify_proofs",
      name: "VERIFY_ZK_PROOFS",
      description: "Verify off-chain zero-knowledge circuit proofs.",
      category: "verification",
      isGranted: true,
    },
  ],
  restrictedScopes: [
    {
      id: "scope_view_salaries",
      name: "VIEW_UNMASKED_SALARIES",
      description: "Prohibited: Viewing raw salary amounts.",
      category: "restricted",
      isGranted: false,
    },
  ],
});

const createRevokedGrant = (): AuditGrantDetail => ({
  id: "grant_revoked_002",
  auditorName: "Beta Compliance Group",
  auditorOrg: "Beta Audit Corp",
  auditorAddress: "0xAAAA22223333444455556666777788889999BBBB",
  grantedBy: "Security Lead",
  createdAt: "2026-08-01T09:00:00Z",
  expiresAt: "2026-09-01T09:00:00Z",
  status: "revoked",
  revokedAt: "2026-08-25T14:30:00Z",
  revokedBy: "Chief Compliance Officer",
  revocationReason: "Audit review period completed; access rotated per safety policy.",
  maskingTier: "FULL_ZERO_KNOWLEDGE",
  accessibleScopes: [
    {
      id: "scope_read_runs",
      name: "READ_PAYROLL_RUNS",
      description: "View encrypted payroll metadata.",
      category: "reads",
      isGranted: true,
    },
  ],
  restrictedScopes: [
    {
      id: "scope_view_salaries",
      name: "VIEW_UNMASKED_SALARIES",
      description: "Prohibited: Viewing raw salary amounts.",
      category: "restricted",
      isGranted: false,
    },
  ],
});

describe("Audit Grant Revocation Status & Timestamp (#515)", () => {
  describe("1. Successful / Active Case", () => {
    it("renders active grant with active badge, expiry date, and allows revoke/extend actions", async () => {
      const user = userEvent.setup();
      const onRevoke = vi.fn();
      const onExtend = vi.fn();
      const grant = createActiveGrant();

      render(
        <AuditGrantScopeDetailsDrawer
          isOpen={true}
          grant={grant}
          onClose={vi.fn()}
          onRevokeGrant={onRevoke}
          onExtendGrant={onExtend}
        />,
      );

      // Verify active badge and absence of revocation banner
      expect(screen.getByText(/ACTIVE GRANT/i)).toBeInTheDocument();
      expect(screen.queryByTestId("grant-revoked-banner")).not.toBeInTheDocument();
      expect(screen.queryByTestId("grant-meta-revoked-at")).not.toBeInTheDocument();

      // Verify revoke action is enabled and triggers callback
      const revokeBtn = screen.getByTestId("revoke-grant-btn");
      expect(revokeBtn).not.toBeDisabled();
      expect(revokeBtn).toHaveTextContent(/Revoke Grant/i);
      await user.click(revokeBtn);
      expect(onRevoke).toHaveBeenCalledTimes(1);
      expect(onRevoke).toHaveBeenCalledWith("grant_active_001");

      // Verify extend action is enabled and triggers callback
      const extendBtn = screen.getByTestId("extend-grant-btn");
      expect(extendBtn).not.toBeDisabled();
      await user.click(extendBtn);
      expect(onExtend).toHaveBeenCalledTimes(1);
      expect(onExtend).toHaveBeenCalledWith("grant_active_001");
    });

    it("verifies isAuditGrantRevoked returns false for active grant", () => {
      const grant = createActiveGrant();
      expect(isAuditGrantRevoked(grant)).toBe(false);
    });
  });

  describe("2. Rejected / Revoked Case", () => {
    it("renders revoked grant with revocation status badge, banner, exact timestamp, actor, and reason", () => {
      const grant = createRevokedGrant();

      render(
        <AuditGrantScopeDetailsDrawer
          isOpen={true}
          grant={grant}
          onClose={vi.fn()}
          onRevokeGrant={vi.fn()}
          onExtendGrant={vi.fn()}
        />,
      );

      // Revocation status badge
      const statusBadge = screen.getByTestId("grant-revocation-status-badge");
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveTextContent(/REVOKED/i);

      // Revocation banner with exact timestamp and reason
      const banner = screen.getByTestId("grant-revoked-banner");
      expect(banner).toBeInTheDocument();
      expect(screen.getByTestId("grant-revoked-status-title")).toHaveTextContent("Audit Grant Revoked");

      const timestamp = screen.getByTestId("grant-revoked-timestamp");
      expect(timestamp).toBeInTheDocument();
      expect(timestamp.textContent).toContain("2026");

      const actor = screen.getByTestId("grant-revoked-by");
      expect(actor).toHaveTextContent("Chief Compliance Officer");

      const reason = screen.getByTestId("grant-revoked-reason");
      expect(reason).toHaveTextContent(/Audit review period completed/i);

      // Metadata card revoked timestamp
      const metaRevokedAt = screen.getByTestId("grant-meta-revoked-at");
      expect(metaRevokedAt).toBeInTheDocument();
      expect(metaRevokedAt.textContent).toContain("2026");
    });

    it("disables revoke and extend action buttons when grant is already revoked to prevent double revocation", async () => {
      const user = userEvent.setup();
      const onRevoke = vi.fn();
      const onExtend = vi.fn();
      const grant = createRevokedGrant();

      render(
        <AuditGrantScopeDetailsDrawer
          isOpen={true}
          grant={grant}
          onClose={vi.fn()}
          onRevokeGrant={onRevoke}
          onExtendGrant={onExtend}
        />,
      );

      const revokeBtn = screen.getByTestId("revoke-grant-btn");
      expect(revokeBtn).toBeDisabled();
      expect(revokeBtn).toHaveAttribute("aria-disabled", "true");
      expect(revokeBtn).toHaveTextContent(/Grant Revoked/i);
      await user.click(revokeBtn);
      expect(onRevoke).not.toHaveBeenCalled();

      const extendBtn = screen.getByTestId("extend-grant-btn");
      expect(extendBtn).toBeDisabled();
      expect(extendBtn).toHaveAttribute("aria-disabled", "true");
      await user.click(extendBtn);
      expect(onExtend).not.toHaveBeenCalled();
    });

    it("surfaces revocation status and timestamp in the dashboard layer table view (/audit)", async () => {
      const user = userEvent.setup();

      render(<AuditGrantsPage />);

      expect(screen.getByTestId("grant-expiry-guidance")).toHaveTextContent(
        /auditor grant expires soon/i,
      );
      expect(screen.getByTestId("grant-expiry-guidance")).toHaveTextContent(
        /Inspect Scope/i,
      );

      // Verify table rendered with seeded grants
      expect(screen.getByTestId("audit-grants-table")).toBeInTheDocument();
      expect(screen.getByTestId("revoked-grants-count")).toBeInTheDocument();

      // Check revoked grants display timestamp and badge
      const revokedRow = screen.getByTestId("grant-row-grant_audit_882041");
      expect(revokedRow).toBeInTheDocument();
      expect(revokedRow).toHaveTextContent(/REVOKED/i);
      expect(revokedRow).toHaveTextContent(/Revoked on:/i);

      // Filter by revoked grants
      const filterRevokedBtn = screen.getByRole("button", { name: /Revoked/i });
      await user.click(filterRevokedBtn);

      // Ensure active grants are filtered out
      expect(screen.queryByTestId("grant-row-grant_audit_991823")).not.toBeInTheDocument();
      expect(screen.getByTestId("grant-row-grant_audit_882041")).toBeInTheDocument();
    });
  });

  describe("3. Boundary Cases & Privacy Guarantees", () => {
    it("handles revoked grant with missing or null revokedAt timestamp gracefully", () => {
      const grant: AuditGrantDetail = {
        ...createRevokedGrant(),
        revokedAt: null,
      };

      render(
        <AuditGrantScopeDetailsDrawer
          isOpen={true}
          grant={grant}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId("grant-revoked-banner")).toBeInTheDocument();
      const timestamp = screen.getByTestId("grant-revoked-timestamp");
      expect(timestamp).toHaveTextContent("Timestamp unavailable");
      expect(screen.getByTestId("grant-meta-revoked-at")).toHaveTextContent("Timestamp unavailable");
    });

    it("handles malformed date string in revokedAt without crashing", () => {
      const formatted = formatRevocationTimestamp("malformed-invalid-date-string");
      expect(formatted).toBe("Timestamp unavailable");

      render(
        <AuditGrantRevocationStatus
          status="revoked"
          revokedAt="malformed-date"
          variant="banner"
        />,
      );

      expect(screen.getByTestId("grant-revoked-timestamp")).toHaveTextContent("Timestamp unavailable");
    });

    it("handles missing revokedBy and revocationReason gracefully without rendering undefined", () => {
      render(
        <AuditGrantRevocationStatus
          status="revoked"
          revokedAt="2026-08-25T14:30:00Z"
          revokedBy={undefined}
          revocationReason={undefined}
          variant="banner"
        />,
      );

      expect(screen.getByTestId("grant-revoked-banner")).toBeInTheDocument();
      expect(screen.queryByTestId("grant-revoked-by")).not.toBeInTheDocument();
      expect(screen.queryByTestId("grant-revoked-reason")).not.toBeInTheDocument();
      expect(screen.getByTestId("grant-revoked-banner").textContent).not.toContain("undefined");
      expect(screen.getByTestId("grant-revoked-banner").textContent).not.toContain("null");
    });

    it("renders inline variant correctly when grant is revoked", () => {
      render(
        <AuditGrantRevocationStatus
          status="revoked"
          revokedAt="2026-08-25T14:30:00Z"
          variant="inline"
        />,
      );

      expect(screen.getByTestId("grant-revoked-inline")).toBeInTheDocument();
      expect(screen.getByTestId("grant-revoked-timestamp")).toBeInTheDocument();
    });

    it("ensures zero private employee names, raw salaries, or secrets leak in the revocation status display", () => {
      const grant = createRevokedGrant();

      const { container } = render(
        <AuditGrantScopeDetailsDrawer
          isOpen={true}
          grant={grant}
          onClose={vi.fn()}
        />,
      );

      const html = container.innerHTML;

      // Assert no financial compensation terms or dollar amounts
      expect(html).not.toMatch(/\$\d+/);
      expect(html).not.toContain("salary_amount");
      expect(html).not.toContain("secret_key");
      expect(html).not.toContain("private_key");
      expect(html).not.toContain("employee_ssn");
    });
  });
});

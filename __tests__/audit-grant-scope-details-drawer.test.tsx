import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditGrantScopeDetailsDrawer } from "@/components/features/audit/AuditGrantScopeDetailsDrawer";

describe("AuditGrantScopeDetailsDrawer (#515)", () => {
  it("renders audit grant scope details drawer when open", () => {
    render(
      <AuditGrantScopeDetailsDrawer
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("audit-grant-scope-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("auditor-identity-header")).toBeInTheDocument();
    expect(screen.getByTestId("grant-expiry-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("masking-tier-badge")).toHaveTextContent("FULL ZERO KNOWLEDGE");
    expect(screen.getByTestId("grant-accessible-scopes")).toBeInTheDocument();
    expect(screen.getByTestId("grant-restricted-scopes")).toBeInTheDocument();
  });

  it("does not render drawer when isOpen is false", () => {
    render(
      <AuditGrantScopeDetailsDrawer
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByTestId("audit-grant-scope-drawer")).not.toBeInTheDocument();
  });

  it("calls onClose when close drawer button is clicked", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <AuditGrantScopeDetailsDrawer
        isOpen={true}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByTestId("close-drawer-btn");
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("triggers extend, revoke, and export scope callbacks", async () => {
    const user = userEvent.setup();
    const handleExtend = vi.fn();
    const handleRevoke = vi.fn();
    const handleExport = vi.fn();

    render(
      <AuditGrantScopeDetailsDrawer
        isOpen={true}
        onClose={vi.fn()}
        onExtendGrant={handleExtend}
        onRevokeGrant={handleRevoke}
        onExportScope={handleExport}
      />
    );

    const extendBtn = screen.getByTestId("extend-grant-btn");
    await user.click(extendBtn);
    expect(handleExtend).toHaveBeenCalledTimes(1);

    const revokeBtn = screen.getByTestId("revoke-grant-btn");
    await user.click(revokeBtn);
    expect(handleRevoke).toHaveBeenCalledTimes(1);

    const exportBtn = screen.getByTestId("export-scope-btn");
    await user.click(exportBtn);
    expect(handleExport).toHaveBeenCalledTimes(1);
  });
});

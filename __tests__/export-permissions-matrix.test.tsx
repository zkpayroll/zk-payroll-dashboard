import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ExportPermissionsMatrix from "@/components/features/exports/ExportPermissionsMatrix";
import { EXPORT_PERMISSIONS, canExport } from "@/lib/auth/roles";

describe("ExportPermissionsMatrix", () => {
  it("renders a row for every export permission key", () => {
    render(<ExportPermissionsMatrix />);
    for (const key of Object.keys(EXPORT_PERMISSIONS)) {
      expect(screen.getByTestId(`export-permission-${key}-admin`)).toBeInTheDocument();
    }
  });

  it("renders the three role columns", () => {
    render(<ExportPermissionsMatrix />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("marks treasury-snapshot as allowed only for admin", () => {
    render(<ExportPermissionsMatrix />);
    expect(screen.getByTestId("export-permission-treasury-snapshot-admin")).toHaveTextContent(
      "Allowed",
    );
    expect(screen.getByTestId("export-permission-treasury-snapshot-operator")).toHaveTextContent(
      "Restricted",
    );
    expect(screen.getByTestId("export-permission-treasury-snapshot-auditor")).toHaveTextContent(
      "Restricted",
    );
  });

  it("shows the restriction reason text for a restricted cell", () => {
    render(<ExportPermissionsMatrix />);
    expect(
      screen.getAllByText("Treasury operations are admin-only. Please contact an administrator.")[0],
    ).toBeInTheDocument();
  });


  it("matches canExport for every export type / role combination", () => {
    render(<ExportPermissionsMatrix />);
    for (const key of Object.keys(EXPORT_PERMISSIONS)) {
      for (const role of ["admin", "operator", "auditor"] as const) {
        const allowed = canExport(role, key);
        const cell = screen.getByTestId(`export-permission-${key}-${role}`);
        expect(cell.textContent).toContain(allowed ? "Allowed" : "Restricted");
      }
    }
  });
});

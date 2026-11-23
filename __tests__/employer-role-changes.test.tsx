/**
 * Employer role change UI behavior (issue #896).
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  USER_ROLES,
  classifyRoleChange,
  describeEmployerRoleChange,
  isUserRole,
  usableNavigationLabels,
} from "@/lib/company/employerRoleChange";
import EmployerRoleChangeNotice from "@/components/features/company/EmployerRoleChangeNotice";
import EmployerRoleChangePreview from "@/components/features/company/EmployerRoleChangePreview";

function impactOf(previous: unknown, next: unknown, path?: string) {
  const result = describeEmployerRoleChange(previous, next, path);
  if (!result.ok) throw new Error(`expected ok result, got ${result.code}`);
  return result.impact;
}

describe("classifyRoleChange", () => {
  it.each([
    ["admin", "admin", "unchanged"],
    ["operator", "admin", "promotion"],
    ["auditor", "admin", "promotion"],
    ["admin", "operator", "demotion"],
    ["admin", "auditor", "demotion"],
    ["operator", "auditor", "lateral"],
    ["auditor", "operator", "lateral"],
  ] as const)("%s -> %s is %s", (from, to, kind) => {
    expect(classifyRoleChange(from, to)).toBe(kind);
  });
});

describe("describeEmployerRoleChange", () => {
  it("lists areas and actions lost when an admin is demoted to operator", () => {
    const impact = impactOf("admin", "operator", "/payroll/execute");
    expect(impact.kind).toBe("demotion");
    expect(impact.lostNavigation).toEqual(
      expect.arrayContaining(["Treasury", "Company Setup", "Switch Company", "Employees"]),
    );
    expect(impact.gainedNavigation).toEqual([]);
    expect(impact.lostCapabilities).toContain("Switch the active company");
    expect(impact.currentPathAllowed).toBe(true);
    expect(impact.redirectTo).toBeNull();
    expect(impact.requiresSessionRefresh).toBe(true);
  });

  it("treats a disabled sidebar entry as lost access", () => {
    // Operators still see "Employees" in the sidebar, but disabled.
    expect(usableNavigationLabels("operator")).not.toContain("Employees");
    expect(impactOf("admin", "operator").lostNavigation).toContain("Employees");
  });

  it("redirects to the dashboard when the current page is no longer accessible", () => {
    const impact = impactOf("admin", "operator", "/treasury");
    expect(impact.currentPathAllowed).toBe(false);
    expect(impact.redirectTo).toBe("/");
    expect(impact.message).toMatch(/Return to the dashboard/);
  });

  it("lists newly available areas on promotion", () => {
    const impact = impactOf("auditor", "admin", "/compliance");
    expect(impact.kind).toBe("promotion");
    expect(impact.gainedNavigation).toEqual(
      expect.arrayContaining(["Execute Payroll", "Treasury", "Switch Company"]),
    );
    expect(impact.lostNavigation).toEqual([]);
    expect(impact.currentPathAllowed).toBe(true);
  });

  it("reports both gains and losses on a lateral move", () => {
    const impact = impactOf("operator", "auditor", "/payroll/execute");
    expect(impact.kind).toBe("lateral");
    expect(impact.gainedNavigation).toContain("Compliance");
    expect(impact.lostNavigation).toContain("Execute Payroll");
    expect(impact.lostCapabilities).toContain("Cancel payroll runs");
    expect(impact.redirectTo).toBe("/");
  });

  it("does not require a session refresh when the role is unchanged", () => {
    const impact = impactOf("operator", "operator", "/treasury");
    expect(impact.kind).toBe("unchanged");
    expect(impact.requiresSessionRefresh).toBe(false);
    expect(impact.gainedNavigation).toEqual([]);
    expect(impact.lostNavigation).toEqual([]);
  });

  it("defaults the current path to the dashboard, which every role can open", () => {
    for (const from of USER_ROLES) {
      for (const to of USER_ROLES) {
        expect(impactOf(from, to).currentPathAllowed).toBe(true);
      }
    }
  });

  it.each([
    [undefined, "operator", "unknown-previous-role"],
    ["superuser", "operator", "unknown-previous-role"],
    ["admin", "", "unknown-next-role"],
    ["admin", "ADMIN", "unknown-next-role"],
    ["admin", null, "unknown-next-role"],
  ])("returns an actionable error for %s -> %s", (from, to, code) => {
    const result = describeEmployerRoleChange(from, to);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(code);
    expect(result.message).toMatch(/Sign out and sign back in/);
  });

  it("never echoes raw role input or wallet-like values in messages", () => {
    const wallet = "GBOPS7643QOPERATOR234567890123456789012345678901234567";
    const result = describeEmployerRoleChange("admin", wallet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain(wallet);

    const impact = impactOf("admin", "auditor", "/treasury");
    const text = JSON.stringify(impact);
    expect(text).not.toMatch(/G[A-Z2-7]{55}/);
  });

  it("isUserRole only accepts known roles", () => {
    expect(USER_ROLES.every(isUserRole)).toBe(true);
    expect(isUserRole("owner")).toBe(false);
    expect(isUserRole(1)).toBe(false);
  });
});

describe("EmployerRoleChangeNotice", () => {
  it("renders nothing when the role is unchanged", () => {
    const { container } = render(
      <EmployerRoleChangeNotice previousRole="admin" nextRole="admin" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a demotion as an alert with lost areas and a redirect action", () => {
    const onNavigate = vi.fn();
    render(
      <EmployerRoleChangeNotice
        previousRole="admin"
        nextRole="operator"
        currentPath="/treasury"
        onNavigate={onNavigate}
      />,
    );
    const notice = screen.getByRole("alert");
    expect(notice).toHaveAttribute("data-role-change-kind", "demotion");
    expect(
      within(notice).getByText("Your role changed from Admin to Operator"),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("employer-role-change-lost")).getByText("Treasury"))
      .toBeInTheDocument();
    expect(screen.queryByTestId("employer-role-change-gained")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to dashboard" }));
    expect(onNavigate).toHaveBeenCalledWith("/");
  });

  it("renders a promotion as a status with gained areas and no redirect", () => {
    const onRefreshSession = vi.fn();
    render(
      <EmployerRoleChangeNotice
        previousRole="operator"
        nextRole="admin"
        currentPath="/payroll/execute"
        onRefreshSession={onRefreshSession}
      />,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("data-role-change-kind", "promotion");
    expect(within(screen.getByTestId("employer-role-change-gained")).getByText("Treasury"))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to dashboard" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Refresh session/ }));
    expect(onRefreshSession).toHaveBeenCalledTimes(1);
  });

  it("escalates a lateral move to an alert when the current page is lost", () => {
    render(
      <EmployerRoleChangeNotice
        previousRole="operator"
        nextRole="auditor"
        currentPath="/payroll/execute"
      />,
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-role-change-kind", "lateral");
    expect(screen.getByTestId("employer-role-change-gained")).toHaveTextContent("Compliance");
    expect(screen.getByTestId("employer-role-change-lost")).toHaveTextContent("Execute Payroll");
  });

  it("shows an actionable error for an unrecognized role", () => {
    render(<EmployerRoleChangeNotice previousRole="admin" nextRole="owner" />);
    const error = screen.getByTestId("employer-role-change-error");
    expect(error).toHaveTextContent("Role change could not be applied");
    expect(error).toHaveTextContent(/ask a company admin to confirm your role/);
    expect(error).not.toHaveTextContent("owner");
  });
});

describe("EmployerRoleChangePreview", () => {
  it("renders the default admin -> operator preview on the treasury page", () => {
    render(<EmployerRoleChangePreview />);
    expect(screen.getByTestId("employer-role-change-notice")).toHaveAttribute(
      "data-role-change-kind",
      "demotion",
    );
    expect(screen.getByRole("button", { name: "Go to dashboard" })).toBeInTheDocument();
  });

  it("updates the notice when the roles change and hides it when unchanged", () => {
    render(<EmployerRoleChangePreview />);
    fireEvent.change(screen.getByLabelText("New role"), { target: { value: "admin" } });
    expect(screen.queryByTestId("employer-role-change-notice")).not.toBeInTheDocument();
    expect(screen.getByTestId("employer-role-change-unchanged")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Previous role"), { target: { value: "auditor" } });
    expect(screen.getByTestId("employer-role-change-notice")).toHaveAttribute(
      "data-role-change-kind",
      "promotion",
    );
  });

  it("lists every role transition in the matrix", () => {
    render(<EmployerRoleChangePreview />);
    const rows = within(screen.getByTestId("employer-role-change-matrix")).getAllByRole("row");
    // header + 3 roles × 2 other roles
    expect(rows).toHaveLength(1 + USER_ROLES.length * (USER_ROLES.length - 1));
    expect(screen.getByTestId("role-transition-operator-auditor")).toHaveTextContent(
      "Lateral move",
    );
  });
});

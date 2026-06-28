import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { canAccessPath, getNavigationForRole, ROLE_LABELS } from "@/lib/auth/roles";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import type { UserRole } from "@/types";

// ── Utility: canAccessPath ───────────────────────────────────────────────────

describe("canAccessPath()", () => {
  it("allows every role on the root dashboard", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/")).toBe(true);
    }
  });

  it("allows only admin on /employees and /employees/add", () => {
    for (const path of ["/employees", "/employees/add"]) {
      expect(canAccessPath("admin", path)).toBe(true);
      for (const role of ["operator", "auditor"] as UserRole[]) {
        expect(canAccessPath(role, path)).toBe(false);
      }
    }
  });

  it("allows admin and operator on /payroll/execute", () => {
    expect(canAccessPath("admin", "/payroll/execute")).toBe(true);
    expect(canAccessPath("operator", "/payroll/execute")).toBe(true);
    expect(canAccessPath("auditor", "/payroll/execute")).toBe(false);
  });

  it("allows admin and auditor on /compliance", () => {
    expect(canAccessPath("admin", "/compliance")).toBe(true);
    expect(canAccessPath("auditor", "/compliance")).toBe(true);
    expect(canAccessPath("operator", "/compliance")).toBe(false);
  });

  it("allows admin, operator, auditor on /history", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/history")).toBe(true);
    }
  });

  it("allows only admin on /treasury", () => {
    expect(canAccessPath("admin", "/treasury")).toBe(true);
    for (const role of ["operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/treasury")).toBe(false);
    }
  });

  it("allows only admin on /setup", () => {
    expect(canAccessPath("admin", "/setup")).toBe(true);
    for (const role of ["operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/setup")).toBe(false);
    }
  });

  it("allows admin, operator, auditor on /settings", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/settings")).toBe(true);
    }
  });

  it("allows only admin on /admin", () => {
    expect(canAccessPath("admin", "/admin")).toBe(true);
    for (const role of ["operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/admin")).toBe(false);
    }
  });

  it("allows every role on /incidents", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessPath(role, "/incidents")).toBe(true);
    }
  });
});

// ── Utility: getNavigationForRole ────────────────────────────────────────────

describe("getNavigationForRole()", () => {
  it("admin sees all 8 nav links", () => {
    const links = getNavigationForRole("admin");
    expect(links).toHaveLength(8);
    const labels = links.map((l) => l.label);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Employees");
    expect(labels).toContain("Execute Payroll");
    expect(labels).toContain("History");
    expect(labels).toContain("Treasury");
    expect(labels).toContain("Compliance");
    expect(labels).toContain("Company Setup");
    expect(labels).toContain("Settings");
  });

  it("operator sees 6 links — Compliance and Company Setup hidden", () => {
    const links = getNavigationForRole("operator");
    const labels = links.map((l) => l.label);
    expect(labels).toHaveLength(6);
    expect(labels).not.toContain("Compliance");
    expect(labels).not.toContain("Company Setup");
    expect(labels).toContain("Employees");
    expect(labels).toContain("Execute Payroll");
    expect(labels).toContain("Treasury");
  });

  it("auditor sees 4 links — read-only pages only", () => {
    const links = getNavigationForRole("auditor");
    const labels = links.map((l) => l.label);
    expect(labels).toHaveLength(4);
    expect(labels).toEqual(["Dashboard", "History", "Compliance", "Settings"]);
  });
});

// ── Component: Sidebar (role-aware rendering) ────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Sidebar role-aware rendering", () => {
  it("renders nav links filtered by admin role", () => {
    render(<Sidebar role="admin" />);
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Company Setup")).toBeInTheDocument();
  });

  it("hides compliance and setup for operator", () => {
    render(<Sidebar role="operator" />);
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByText("Execute Payroll")).toBeInTheDocument();
    expect(screen.queryByText("Compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Setup")).not.toBeInTheDocument();
  });

  it("shows only read-only links for auditor", () => {
    render(<Sidebar role="auditor" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute Payroll")).not.toBeInTheDocument();
    expect(screen.queryByText("Treasury")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Setup")).not.toBeInTheDocument();
  });
});

// ── Component: Header role label ─────────────────────────────────────────────

describe("Header role label", () => {
  it("displays Admin label for admin role", () => {
    render(<Header role="admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("displays Operator label for operator role", () => {
    render(<Header role="operator" />);
    expect(screen.getByText("Operator")).toBeInTheDocument();
  });

  it("displays Auditor label for auditor role", () => {
    render(<Header role="auditor" />);
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });
});

// ── ROLE_LABELS ──────────────────────────────────────────────────────────────

describe("ROLE_LABELS", () => {
  it("provides a human-readable label for each role", () => {
    expect(ROLE_LABELS.admin).toBe("Admin");
    expect(ROLE_LABELS.operator).toBe("Operator");
    expect(ROLE_LABELS.auditor).toBe("Auditor");
  });
});

// ── Middleware role gating ────────────────────────────────────────────────────

describe("Middleware role gating", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SESSION_SECRET", "test-secret-that-is-at-least-32-characters-long");
    vi.stubEnv("NODE_ENV", "production");
  });

  async function createToken(publicKey: string, role: UserRole) {
    const { createSessionToken } = await import("@/lib/auth/session");
    return createSessionToken(publicKey, role);
  }

  async function checkRoute(pathname: string, role: UserRole) {
    const { middleware } = await import("@/middleware");
    const url = new URL(`http://localhost:3000${pathname}`);
    const request = new NextRequest(url);
    const token = await createToken("GABCDEF", role);
    request.cookies.set("zk-payroll-session", token);
    return middleware(request);
  }

  it("allows admin on admin-only /employees/add", async () => {
    const response = await checkRoute("/employees/add", "admin");
    expect(response.status).toBe(200);
  });

  it("redirects operator away from admin-only /employees/add", async () => {
    const response = await checkRoute("/employees/add", "operator");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects auditor away from admin-only /employees/add", async () => {
    const response = await checkRoute("/employees/add", "auditor");
    expect(response.status).toBe(307);
  });

  it("allows admin and operator on /payroll/execute", async () => {
    expect((await checkRoute("/payroll/execute", "admin")).status).toBe(200);
    expect((await checkRoute("/payroll/execute", "operator")).status).toBe(200);
  });

  it("redirects auditor from /payroll/execute", async () => {
    const response = await checkRoute("/payroll/execute", "auditor");
    expect(response.status).toBe(307);
  });

  it("allows admin and auditor on /compliance", async () => {
    expect((await checkRoute("/compliance", "admin")).status).toBe(200);
    expect((await checkRoute("/compliance", "auditor")).status).toBe(200);
  });

  it("redirects operator from /compliance", async () => {
    const response = await checkRoute("/compliance", "operator");
    expect(response.status).toBe(307);
  });

  it("allows admin, operator, auditor on /history", async () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect((await checkRoute("/history", role)).status).toBe(200);
    }
  });

  it("allows only admin on /treasury", async () => {
    expect((await checkRoute("/treasury", "admin")).status).toBe(200);
    for (const role of ["operator", "auditor"] as UserRole[]) {
      expect((await checkRoute("/treasury", role)).status).toBe(307);
    }
  });

  it("allows admin on /setup, redirects others", async () => {
    expect((await checkRoute("/setup", "admin")).status).toBe(200);
    for (const role of ["operator", "auditor"] as UserRole[]) {
      expect((await checkRoute("/setup", role)).status).toBe(307);
    }
  });

  it("redirects unauthenticated requests to login", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest(new URL("http://localhost:3000/employees"));
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});

// ── Session API role assignment ──────────────────────────────────────────────

describe("Session API role assignment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SESSION_SECRET", "test-secret-that-is-at-least-32-characters-long");
  });

  async function postSession(publicKey: string) {
    const handler = await import("@/app/api/auth/session/route");
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey }),
    });
    return handler.POST(request);
  }

  it("assigns admin when publicKey matches ADMIN_PUBLIC_KEY", async () => {
    vi.stubEnv("ADMIN_PUBLIC_KEY", "GADMIN123");
    const response = await postSession("GADMIN123");
    const data = await response.json();
    expect(data.role).toBe("admin");
  });

  it("assigns operator when publicKey matches OPERATOR_PUBLIC_KEYS", async () => {
    vi.stubEnv("ADMIN_PUBLIC_KEY", "GADMIN123");
    vi.stubEnv("OPERATOR_PUBLIC_KEYS", "GOPER1, GOPER2");
    const response = await postSession("GOPER2");
    const data = await response.json();
    expect(data.role).toBe("operator");
  });

  it("assigns auditor when publicKey matches AUDITOR_PUBLIC_KEYS", async () => {
    vi.stubEnv("ADMIN_PUBLIC_KEY", "GADMIN123");
    vi.stubEnv("AUDITOR_PUBLIC_KEYS", "GAUDIT1");
    const response = await postSession("GAUDIT1");
    const data = await response.json();
    expect(data.role).toBe("auditor");
  });

  it("assigns operator by default when publicKey matches no known key", async () => {
    vi.stubEnv("ADMIN_PUBLIC_KEY", "GADMIN123");
    vi.stubEnv("OPERATOR_PUBLIC_KEYS", "GOPER1");
    vi.stubEnv("AUDITOR_PUBLIC_KEYS", "GAUDIT1");
    const response = await postSession("GUNKNOWN");
    const data = await response.json();
    expect(data.role).toBe("operator");
  });

  it("returns 400 when publicKey is missing", async () => {
    const handler = await import("@/app/api/auth/session/route");
    const request = new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await handler.POST(request);
    expect(response.status).toBe(400);
  });
});

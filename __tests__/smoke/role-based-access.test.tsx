import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { canAccessRoute, getVisibleNavLinks, ROLE_LABELS } from "@/lib/auth/roles";
import Sidebar from "@/components/layout/Sidebar";
import type { UserRole } from "@/types";

// ── Utility: canAccessRoute ───────────────────────────────────────────────

describe("canAccessRoute()", () => {
  const allRoles: UserRole[] = ["admin", "operator", "auditor", "employee"];

  it("allows every role on the root dashboard", () => {
    for (const role of allRoles) {
      expect(canAccessRoute("/", role)).toBe(true);
    }
  });

  it("allows only admin on /payroll/run", () => {
    expect(canAccessRoute("/payroll/run", "admin")).toBe(true);
    for (const role of ["operator", "auditor", "employee"] as UserRole[]) {
      expect(canAccessRoute("/payroll/run", role)).toBe(false);
    }
  });

  it("allows only admin on /employees/add", () => {
    expect(canAccessRoute("/employees/add", "admin")).toBe(true);
    for (const role of ["operator", "auditor", "employee"] as UserRole[]) {
      expect(canAccessRoute("/employees/add", role)).toBe(false);
    }
  });

  it("allows admin and operator on /payroll/execute", () => {
    expect(canAccessRoute("/payroll/execute", "admin")).toBe(true);
    expect(canAccessRoute("/payroll/execute", "operator")).toBe(true);
    expect(canAccessRoute("/payroll/execute", "auditor")).toBe(false);
    expect(canAccessRoute("/payroll/execute", "employee")).toBe(false);
  });

  it("allows admin and operator on /employees", () => {
    expect(canAccessRoute("/employees", "admin")).toBe(true);
    expect(canAccessRoute("/employees", "operator")).toBe(true);
    expect(canAccessRoute("/employees", "auditor")).toBe(false);
    expect(canAccessRoute("/employees", "employee")).toBe(false);
  });

  it("allows admin and auditor on /compliance", () => {
    expect(canAccessRoute("/compliance", "admin")).toBe(true);
    expect(canAccessRoute("/compliance", "auditor")).toBe(true);
    expect(canAccessRoute("/compliance", "operator")).toBe(false);
    expect(canAccessRoute("/compliance", "employee")).toBe(false);
  });

  it("allows admin, operator, auditor on /history", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessRoute("/history", role)).toBe(true);
    }
    expect(canAccessRoute("/history", "employee")).toBe(false);
  });

  it("allows admin, operator, auditor on /treasury", () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect(canAccessRoute("/treasury", role)).toBe(true);
    }
    expect(canAccessRoute("/treasury", "employee")).toBe(false);
  });

  it("allows only admin on /setup", () => {
    expect(canAccessRoute("/setup", "admin")).toBe(true);
    for (const role of ["operator", "auditor", "employee"] as UserRole[]) {
      expect(canAccessRoute("/setup", role)).toBe(false);
    }
  });

  it("allows every role on /settings", () => {
    for (const role of allRoles) {
      expect(canAccessRoute("/settings", role)).toBe(true);
    }
  });

  it("allows every role on /incidents", () => {
    for (const role of allRoles) {
      expect(canAccessRoute("/incidents", role)).toBe(true);
    }
  });

  it("allows only admin on /admin", () => {
    expect(canAccessRoute("/admin", "admin")).toBe(true);
    for (const role of ["operator", "auditor", "employee"] as UserRole[]) {
      expect(canAccessRoute("/admin", role)).toBe(false);
    }
  });
});

// ── Utility: getVisibleNavLinks ────────────────────────────────────────────

describe("getVisibleNavLinks()", () => {
  it("admin sees all 8 nav links", () => {
    const links = getVisibleNavLinks("admin");
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

  it("operator sees 6 links — no Compliance or Company Setup", () => {
    const links = getVisibleNavLinks("operator");
    const labels = links.map((l) => l.label);
    expect(labels).toHaveLength(6);
    expect(labels).not.toContain("Compliance");
    expect(labels).not.toContain("Company Setup");
    expect(labels).toContain("Employees");
    expect(labels).toContain("Execute Payroll");
  });

  it("auditor sees 5 links — read-only pages only", () => {
    const links = getVisibleNavLinks("auditor");
    const labels = links.map((l) => l.label);
    expect(labels).toHaveLength(5);
    expect(labels).toEqual(["Dashboard", "History", "Treasury", "Compliance", "Settings"]);
  });

  it("employee sees 2 links — Dashboard and Settings only", () => {
    const links = getVisibleNavLinks("employee");
    const labels = links.map((l) => l.label);
    expect(labels).toHaveLength(2);
    expect(labels).toEqual(["Dashboard", "Settings"]);
  });
});

// ── Component: Sidebar (role-aware rendering) ──────────────────────────────

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from "@/stores/authStore";

let testRole: UserRole | null = "admin";

describe("Sidebar role-aware rendering", () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation((selector?: any) => {
      const state = { role: testRole, publicKey: null, isConnected: false, setSession: vi.fn(), clearSession: vi.fn() };
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  it("renders nav links filtered by admin role", () => {
    testRole = "admin";
    render(<Sidebar />);
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Company Setup")).toBeInTheDocument();
  });

  it("hides compliance and setup for operator", () => {
    testRole = "operator";
    render(<Sidebar />);
    expect(screen.getByText("Employees")).toBeInTheDocument();
    expect(screen.getByText("Execute Payroll")).toBeInTheDocument();
    expect(screen.queryByText("Compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Setup")).not.toBeInTheDocument();
  });

  it("shows only read-only links for auditor", () => {
    testRole = "auditor";
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Treasury")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute Payroll")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Setup")).not.toBeInTheDocument();
  });

  it("shows only dashboard and settings for employee", () => {
    testRole = "employee";
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    expect(screen.queryByText("Execute Payroll")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
    expect(screen.queryByText("Treasury")).not.toBeInTheDocument();
    expect(screen.queryByText("Compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Company Setup")).not.toBeInTheDocument();
  });
});

// ── Component: Header role label ───────────────────────────────────────────

import Header from "@/components/layout/Header";

describe("Header role label", () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation((selector?: any) => {
      const state = { role: testRole, publicKey: null, isConnected: false, setSession: vi.fn(), clearSession: vi.fn() };
      return typeof selector === "function" ? selector(state) : state;
    });
  });

  it("displays Admin label for admin role", () => {
    testRole = "admin";
    render(<Header />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("displays Operator label for operator role", () => {
    testRole = "operator";
    render(<Header />);
    expect(screen.getByText("Operator")).toBeInTheDocument();
  });

  it("displays Auditor label for auditor role", () => {
    testRole = "auditor";
    render(<Header />);
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("displays Employee label for employee role", () => {
    testRole = "employee";
    render(<Header />);
    expect(screen.getByText("Employee")).toBeInTheDocument();
  });

  it("displays User label when no role is set", () => {
    testRole = null;
    render(<Header />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });
});

// ── ROLE_LABELS ────────────────────────────────────────────────────────────

describe("ROLE_LABELS", () => {
  it("provides a human-readable label for each role", () => {
    expect(ROLE_LABELS.admin).toBe("Admin");
    expect(ROLE_LABELS.operator).toBe("Operator");
    expect(ROLE_LABELS.auditor).toBe("Auditor");
    expect(ROLE_LABELS.employee).toBe("Employee");
  });
});

// ── Middleware role gating ─────────────────────────────────────────────────

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

  it("redirects employee away from admin-only /employees/add", async () => {
    const response = await checkRoute("/employees/add", "employee");
    expect(response.status).toBe(307);
  });

  it("allows admin and operator on /payroll/execute", async () => {
    const res1 = await checkRoute("/payroll/execute", "admin");
    expect(res1.status).toBe(200);

    const res2 = await checkRoute("/payroll/execute", "operator");
    expect(res2.status).toBe(200);
  });

  it("redirects auditor from /payroll/execute", async () => {
    const response = await checkRoute("/payroll/execute", "auditor");
    expect(response.status).toBe(307);
  });

  it("redirects employee from /payroll/execute", async () => {
    const response = await checkRoute("/payroll/execute", "employee");
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

  it("redirects employee from /history", async () => {
    const response = await checkRoute("/history", "employee");
    expect(response.status).toBe(307);
  });

  it("allows admin, operator, auditor on /treasury", async () => {
    for (const role of ["admin", "operator", "auditor"] as UserRole[]) {
      expect((await checkRoute("/treasury", role)).status).toBe(200);
    }
  });

  it("redirects employee from /treasury", async () => {
    const response = await checkRoute("/treasury", "employee");
    expect(response.status).toBe(307);
  });

  it("allows admin on /setup, redirects others", async () => {
    expect((await checkRoute("/setup", "admin")).status).toBe(200);
    for (const role of ["operator", "auditor", "employee"] as UserRole[]) {
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

// ── Session API role assignment ────────────────────────────────────────────

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

  it("assigns employee when publicKey matches no known key", async () => {
    vi.stubEnv("ADMIN_PUBLIC_KEY", "GADMIN123");
    vi.stubEnv("OPERATOR_PUBLIC_KEYS", "GOPER1");
    vi.stubEnv("AUDITOR_PUBLIC_KEYS", "GAUDIT1");
    const response = await postSession("GUNKNOWN");
    const data = await response.json();
    expect(data.role).toBe("employee");
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

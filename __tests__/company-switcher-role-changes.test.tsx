import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import CompanySwitcher from "@/components/features/company/CompanySwitcher";
import { useCompanyStore } from "@/stores/company";
import { useWalletStore } from "@/stores/walletStore";
import type { Company } from "@/types/models";

/**
 * Component tests for how the company switcher reacts to employer role
 * changes (#895): the session role is re-read from `/api/auth/session`, and a
 * promotion, demotion, revoked session, or failed check must change what the
 * switcher allows — with actionable messages that never expose private
 * payroll data.
 */

const ADMIN_A = `G${"A".repeat(55)}`;
const ADMIN_B = `G${"B".repeat(55)}`;

const primary: Company = {
  id: "company_primary",
  name: "Primary Co",
  admin: ADMIN_A,
  treasury: `G${"C".repeat(55)}`,
  employeeCount: 3,
  isActive: true,
};
const secondary: Company = { ...primary, id: "company_secondary", name: "Secondary Co" };
const foreign: Company = { ...primary, id: "company_foreign", name: "Foreign Co", admin: ADMIN_B };
const misconfigured: Company = {
  ...primary,
  id: "company_misconfigured",
  name: "Misconfigured Co",
  admin: "not-a-stellar-address",
};
const inactive: Company = { ...primary, id: "company_inactive", name: "Dormant Co", isActive: false };

// Private values a misbehaving session endpoint could echo back. None of them
// may ever reach the rendered switcher.
const PRIVATE_PAYLOAD = {
  error: "Failed to retrieve session",
  employee: "Ada Okafor",
  salary: "8500.00 USDC",
  publicKey: ADMIN_A,
};
const PRIVATE_PATTERN = /Ada Okafor|8500|USDC|salary|employee/i;

type SessionResponse = { ok: boolean; status?: number; body?: unknown; badJson?: boolean };

function sessionResponse({ ok, status = ok ? 200 : 401, body, badJson }: SessionResponse) {
  return {
    ok,
    status,
    json: badJson
      ? async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        }
      : async () => body,
  };
}

function mockSession(...responses: SessionResponse[]) {
  const fetchMock = vi.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(sessionResponse(r)));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const trigger = (name: RegExp = /Primary Co/) => screen.getByRole("button", { name });
const option = (name: RegExp) => screen.findByRole("option", { name });

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
  return screen.findByRole("listbox");
}

describe("CompanySwitcher — employer role changes", () => {
  beforeEach(() => {
    useCompanyStore.setState({ company: primary });
    useWalletStore.setState({ publicKey: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("success", () => {
    it("reads the role from the session endpoint without caching", async () => {
      const fetchMock = mockSession({ ok: true, body: { role: "admin" } });
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });
    });

    it("lets a verified admin switch, closing the list and updating the trigger", async () => {
      mockSession({ ok: true, body: { role: "admin" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await openList(user);
      const target = await option(/Secondary Co/);
      await waitFor(() => expect(target).toBeEnabled());
      await user.click(target);

      expect(useCompanyStore.getState().company?.id).toBe("company_secondary");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(trigger(/Secondary Co/)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("treats reselecting the active company as a no-op", async () => {
      mockSession({ ok: true, body: { role: "admin" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await openList(user);
      const current = await option(/Primary Co/);
      expect(current).toHaveAttribute("aria-selected", "true");
      await waitFor(() => expect(current).toBeEnabled());
      await user.click(current);

      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears an earlier block once a permitted switch succeeds", async () => {
      mockSession({ ok: true, body: { role: "admin" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, inactive, secondary]} />);

      await openList(user);
      const dormant = await option(/Dormant Co/);
      await waitFor(() => expect(dormant).toBeEnabled());
      await user.click(dormant);
      expect(await screen.findByText(/Dormant Co is inactive/)).toBeInTheDocument();

      await user.click(await option(/Secondary Co/));
      expect(screen.queryByText(/Dormant Co is inactive/)).not.toBeInTheDocument();
      expect(useCompanyStore.getState().company?.id).toBe("company_secondary");
    });
  });

  describe("role changes between checks", () => {
    it("applies a demotion picked up by the retry: admin access is not assumed", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockResolvedValueOnce(sessionResponse({ ok: true, body: { role: "operator" } }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await user.click(await screen.findByRole("button", { name: "Retry access check" }));

      expect(await screen.findByText(/Your current role cannot switch companies/)).toBeInTheDocument();
      await openList(user);
      const target = await option(/Secondary Co/);
      await waitFor(() => expect(target).toBeEnabled());
      await user.click(target);

      expect(screen.getByText(/Only admins can switch the active company context/)).toBeInTheDocument();
      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
    });

    it("applies a promotion picked up by the retry", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockResolvedValueOnce(sessionResponse({ ok: true, body: { role: "admin" } }));
      global.fetch = fetchMock as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await user.click(await screen.findByRole("button", { name: "Retry access check" }));
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());

      await openList(user);
      const target = await option(/Secondary Co/);
      await waitFor(() => expect(target).toBeEnabled());
      await user.click(target);
      expect(useCompanyStore.getState().company?.id).toBe("company_secondary");
    });

    it("blocks an auditor and points them at signing in again to refresh permissions", async () => {
      mockSession({ ok: true, body: { role: "auditor" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      const notice = await screen.findByText(/Your current role cannot switch companies/);
      expect(notice).toHaveTextContent(/sign in again to refresh permissions/i);
      expect(within(notice.closest("[role=alert]") as HTMLElement).getByRole("link")).toHaveAttribute(
        "href",
        "/login?redirect=%2Fcompany%2Fswitch",
      );

      await openList(user);
      await user.click(await option(/Secondary Co/));
      expect(screen.getByText(/Only admins can switch/)).toBeInTheDocument();
      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
    });
  });

  describe("failure", () => {
    it("asks for a fresh sign-in when the session was revoked (401)", async () => {
      mockSession({ ok: false, status: 401, body: { error: "Invalid or expired session" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      expect(await screen.findByText(/Your session could not be verified/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
        "href",
        "/login?redirect=%2Fcompany%2Fswitch",
      );
      expect(screen.queryByRole("button", { name: "Retry access check" })).not.toBeInTheDocument();

      await openList(user);
      expect(await option(/Secondary Co/)).toBeDisabled();
    });

    it("offers a retry, not a sign-in, when the session service fails (5xx)", async () => {
      const fetchMock = mockSession(
        { ok: false, status: 503, body: PRIVATE_PAYLOAD },
        { ok: true, body: { role: "admin" } },
      );
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      expect(await screen.findByText(/Could not verify your employer access/)).toBeInTheDocument();
      expect(screen.queryByText(/Your session could not be verified/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Retry access check" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());

      await openList(user);
      await waitFor(async () => expect(await option(/Secondary Co/)).toBeEnabled());
    });

    it("offers a retry when the session response is not valid JSON", async () => {
      mockSession({ ok: true, badJson: true });
      render(<CompanySwitcher companies={[primary]} />);

      expect(await screen.findByText(/Could not verify your employer access/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry access check" })).toBeInTheDocument();
    });

    it.each([
      ["a 500 error body", { ok: false, status: 500, body: PRIVATE_PAYLOAD }],
      ["a 401 error body", { ok: false, status: 401, body: PRIVATE_PAYLOAD }],
      ["an unrecognised role", { ok: true, body: { ...PRIVATE_PAYLOAD, role: "owner" } }],
    ] as const)("never renders private payroll data from %s", async (_label, response) => {
      mockSession(response);
      const user = userEvent.setup();
      const { container } = render(<CompanySwitcher companies={[primary, secondary]} />);

      await screen.findByRole("alert");
      await openList(user);
      expect(container).not.toHaveTextContent(PRIVATE_PATTERN);
      expect(container).not.toHaveTextContent(ADMIN_A);
    });

    it("explains a wallet that does not administer the target without exposing either address", async () => {
      mockSession({ ok: true, body: { role: "admin" } });
      useWalletStore.setState({ publicKey: ADMIN_A });
      const user = userEvent.setup();
      const { container } = render(<CompanySwitcher companies={[primary, foreign]} />);

      await openList(user);
      const target = await option(/Foreign Co/);
      await waitFor(() => expect(target).toBeEnabled());
      await user.click(target);

      expect(
        screen.getByText("Your connected wallet is not the configured admin for Foreign Co."),
      ).toBeInTheDocument();
      expect(container).not.toHaveTextContent(ADMIN_A);
      expect(container).not.toHaveTextContent(ADMIN_B);
      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
    });

    it("blocks a company with a broken admin address and says how to fix it", async () => {
      mockSession({ ok: true, body: { role: "admin" } });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, misconfigured]} />);

      await openList(user);
      const target = await option(/Misconfigured Co/);
      await waitFor(() => expect(target).toBeEnabled());
      await user.click(target);

      expect(screen.getByText(/Fix its configuration before switching/)).toBeInTheDocument();
      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
    });
  });

  describe("boundaries", () => {
    it.each([
      ["an unknown role", { role: "owner" }],
      ["a wrongly cased role", { role: "ADMIN" }],
      ["a null role", { role: null }],
      ["a numeric role", { role: 1 }],
      ["a missing role", { publicKey: ADMIN_A }],
      ["a null body", null],
    ])("treats %s as an unverified session", async (_label, body) => {
      mockSession({ ok: true, body });
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      expect(await screen.findByText(/Your session could not be verified/)).toBeInTheDocument();
      expect(screen.queryByText(/Your current role cannot switch/)).not.toBeInTheDocument();
      await openList(user);
      expect(await option(/Secondary Co/)).toBeDisabled();
    });

    it("keeps every option disabled and shows no alert while the role check is pending", async () => {
      global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<CompanySwitcher companies={[primary, secondary]} />);

      await openList(user);
      const target = await option(/Secondary Co/);
      expect(target).toBeDisabled();
      await user.click(target);

      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("ignores a role that resolves after the switcher unmounts", async () => {
      let resolveSession: (value: unknown) => void = () => {};
      global.fetch = vi.fn(
        () => new Promise((resolve) => (resolveSession = resolve)),
      ) as unknown as typeof fetch;
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const { unmount } = render(<CompanySwitcher companies={[primary]} />);
      unmount();
      resolveSession(sessionResponse({ ok: true, body: { role: "admin" } }));
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleError).not.toHaveBeenCalled();
      expect(useCompanyStore.getState().company?.id).toBe("company_primary");
    });
  });
});

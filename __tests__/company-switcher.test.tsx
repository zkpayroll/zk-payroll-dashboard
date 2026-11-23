import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import CompanySwitcher from "@/components/features/company/CompanySwitcher";
import { useCompanyStore } from "@/stores/company";
import type { Company } from "@/types/models";
import userEvent from "@testing-library/user-event";

const companies: Company[] = [
  {
    id: "company_active",
    name: "Active Co",
    admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    employeeCount: 2,
    isActive: true,
  },
  {
    id: "company_inactive",
    name: "Inactive Co",
    admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    employeeCount: 1,
    isActive: false,
  },
];

describe("CompanySwitcher", () => {
  beforeEach(() => {
    useCompanyStore.setState({ company: companies[0] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role: "admin" }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the company list on click", async () => {
    render(<CompanySwitcher companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: /Active Co/i }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Inactive Co")).toBeInTheDocument();
  });

  it("blocks switching into an inactive company and shows the reason", async () => {
    render(<CompanySwitcher companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: /Active Co/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Inactive Co"));

    await waitFor(() => {
      expect(
        screen.getByText(/Inactive Co is inactive and cannot be switched into/),
      ).toBeInTheDocument();
    });
    expect(useCompanyStore.getState().company?.id).toBe("company_active");
  });

  it("switches company after employer access is verified", async () => {
    const user = userEvent.setup();
    const secondActiveCompany = { ...companies[0], id: "company_second", name: "Second Co" };
    render(<CompanySwitcher companies={[companies[0], secondActiveCompany]} />);

    await user.click(screen.getByRole("button", { name: /Active Co/i }));
    const secondCompanyOption = await screen.findByRole("option", { name: /Second Co/i });
    await waitFor(() => expect(secondCompanyOption).toBeEnabled());
    await user.click(secondCompanyOption);

    expect(useCompanyStore.getState().company?.id).toBe("company_second");
  });

  it("offers a safe sign-in recovery when the current employer role cannot switch companies", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ role: "operator" }),
    }) as unknown as typeof fetch;
    render(<CompanySwitcher companies={companies} />);

    expect(
      await screen.findByText(/Your current role cannot switch companies/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fcompany%2Fswitch",
    );

    fireEvent.click(screen.getByRole("button", { name: /Active Co/i }));
    const inactiveOption = await screen.findByRole("option", { name: /Inactive Co/i });
    await user.click(inactiveOption);
    expect(
      screen.getByText(/Only admins can switch the active company context/),
    ).toBeInTheDocument();
    expect(useCompanyStore.getState().company?.id).toBe("company_active");
    expect(screen.queryByText(/employee|salary|payroll/i)).not.toBeInTheDocument();
  });

  it("offers retry after an access-check failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ role: "admin" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<CompanySwitcher companies={companies} />);

    expect(
      await screen.findByText(/Could not verify your employer access/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry access check" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(/Could not verify your employer access/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Retry access check" })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import CompanySwitcher from "@/components/features/company/CompanySwitcher";
import { useCompanyStore } from "@/stores/company";
import type { Company } from "@/types/models";

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
});

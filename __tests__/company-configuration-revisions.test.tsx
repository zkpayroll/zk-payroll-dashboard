import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CompanyConfigurationRevisions } from "@/components/features/company/CompanyConfigurationRevisions";
import { useCompanyStore } from "@/stores/company";

const company = {
  id: "company-a",
  name: "Example",
  admin: "G" + "A".repeat(55),
  treasury: "G" + "B".repeat(55),
  employeeCount: 0,
  isActive: true,
};
beforeEach(() =>
  useCompanyStore.setState({
    company: null,
    configurationSnapshots: {},
    configurationRevisions: {},
  }),
);
afterEach(cleanup);
describe("configuration history settings panel", () => {
  it("explains that a company must be selected", () => {
    render(<CompanyConfigurationRevisions />);
    expect(screen.getByText(/Select or set up a company/)).toBeInTheDocument();
  });
  it("explains the empty state for pre-tracking persisted companies", () => {
    useCompanyStore.setState({ company });
    render(<CompanyConfigurationRevisions />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No revisions recorded yet",
    );
  });
  it("shows newest-first metadata and updates when the company configuration changes", () => {
    useCompanyStore.getState().setCompany(company);
    const { container } = render(<CompanyConfigurationRevisions />);
    act(() =>
      useCompanyStore
        .getState()
        .setCompany({ ...company, treasury: "G" + "C".repeat(55) }),
    );
    const list = screen.getByRole("list", { name: "Configuration revisions" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "Revision 2 - Configuration updated",
    );
    expect(
      screen.getByRole("list", { name: "Changed fields in revision 2" }),
    ).toHaveTextContent("Treasury wallet");
    expect(container.textContent).not.toContain(company.admin);
    expect(container.textContent).not.toContain(company.treasury);
    expect(container.querySelectorAll("time[datetime]")).toHaveLength(2);
    expect(screen.getByText(/not an on-chain audit log/)).toBeInTheDocument();
  });
  it("never displays another company's retained history", () => {
    useCompanyStore.getState().setCompany(company);
    useCompanyStore
      .getState()
      .setCompany({ ...company, id: "company-b", name: "Other" });
    useCompanyStore
      .getState()
      .setCompany({ ...company, id: "company-b", name: "Other updated" });
    render(<CompanyConfigurationRevisions />);
    act(() =>
      useCompanyStore.getState().switchCompany(company, "admin", company.admin),
    );
    expect(screen.queryByText(/Revision 2/)).not.toBeInTheDocument();
    expect(screen.getByText(/Revision 1/)).toBeInTheDocument();
  });
});

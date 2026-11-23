import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalaryCommitmentVersionWarning } from "@/components/features/employees/SalaryCommitmentVersionWarning";

describe("SalaryCommitmentVersionWarning", () => {
  it("does not warn for the supported version", () => {
    const { container } = render(
      <SalaryCommitmentVersionWarning version={1} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("warns about unsupported versions with payroll-safe guidance", () => {
    render(<SalaryCommitmentVersionWarning version={2} />);

    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent("unsupported format");
    expect(warning).toHaveTextContent("supports version 1");
    expect(warning).toHaveTextContent("Verify compatibility");
    expect(warning.textContent).not.toMatch(/\$|\d{4,}/);
  });

  it("treats a missing version as a supported legacy commitment", () => {
    const { container } = render(
      <SalaryCommitmentVersionWarning version={undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

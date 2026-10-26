import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getPolicyRevisionInfo } from "@/lib/payroll/policyRevision";
import { PolicyRevisionBadge } from "@/components/features/payroll/PolicyRevisionBadge";
import PayrollRunDetail, { findPayrollRun } from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

describe("getPolicyRevisionInfo (#751)", () => {
  it("formats a recorded revision", () => {
    expect(getPolicyRevisionInfo(3)).toMatchObject({ recorded: true, revision: 3, label: "r3" });
    expect(getPolicyRevisionInfo(1).label).toBe("r1");
  });

  it.each([undefined, null, 0, -1, 1.5, Number.NaN, "3", {}])("treats %p as not recorded", (value) => {
    expect(getPolicyRevisionInfo(value)).toMatchObject({ recorded: false, revision: null, label: "Not recorded" });
  });
});

describe("PolicyRevisionBadge (#751)", () => {
  it("shows the revision with an accessible name", () => {
    render(<PolicyRevisionBadge revision={4} />);
    const badge = screen.getByTestId("policy-revision-badge");
    expect(badge).toHaveTextContent("r4");
    expect(badge).toHaveAttribute("data-recorded", "true");
    expect(badge).toHaveAttribute("aria-label", expect.stringContaining("revision 4"));
  });

  it("says so when no revision was recorded", () => {
    render(<PolicyRevisionBadge revision={null} />);
    expect(screen.getByTestId("policy-revision-badge")).toHaveTextContent("Not recorded");
  });
});

describe("policy revision on the run detail (#751)", () => {
  it("renders the revision attached to the run", () => {
    const run = { ...MOCK_PAYROLL_RUNS[0], policyRevision: 7 };
    render(<PayrollRunDetail run={run} proofReference={null} />);
    expect(screen.getByTestId("run-policy-revision")).toHaveTextContent("r7");
  });

  it("renders 'Not recorded' for a run without one", () => {
    const run = { ...MOCK_PAYROLL_RUNS[0], policyRevision: undefined };
    render(<PayrollRunDetail run={run} proofReference={null} />);
    expect(screen.getByTestId("run-policy-revision")).toHaveTextContent("Not recorded");
    expect(findPayrollRun(run.id, [run])).toBeDefined();
  });
});

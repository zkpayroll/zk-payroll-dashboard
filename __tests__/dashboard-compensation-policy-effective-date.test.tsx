import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import DashboardCompensationPolicyCheck from "@/components/features/dashboard/DashboardCompensationPolicyCheck";
import type { CompensationPolicyScheduleEntry } from "@/types/compensation";

const MS_PER_DAY = 86_400_000;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

const HEALTHY_SCHEDULE: CompensationPolicyScheduleEntry[] = [
  { id: "comp_current", effectiveDate: daysFromNow(-30), status: "active" },
  { id: "comp_next", effectiveDate: daysFromNow(20), status: "scheduled" },
];

function policy(
  overrides: Partial<CompensationPolicyScheduleEntry> &
    Pick<CompensationPolicyScheduleEntry, "id" | "effectiveDate">,
): CompensationPolicyScheduleEntry {
  return { status: "scheduled", ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardCompensationPolicyCheck", () => {
  it("reports a ready state for a well-ordered schedule", () => {
    render(<DashboardCompensationPolicyCheck policies={HEALTHY_SCHEDULE} />);

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-status", "valid");
    expect(panel).toHaveAttribute("data-can-schedule", "true");
    expect(panel).toHaveAttribute("data-error-count", "0");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(
      screen.getByText(/All 2 policies have a valid effective date/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Review compensation policy/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the next effective date and how far away it is", () => {
    render(<DashboardCompensationPolicyCheck policies={HEALTHY_SCHEDULE} />);

    const next = screen.getByTestId("dashboard-compensation-policy-next");
    expect(next).toHaveTextContent(daysFromNow(20));
    expect(next).toHaveTextContent("20 days away");
  });

  it("renders each scheduled revision without exposing compensation values", () => {
    render(<DashboardCompensationPolicyCheck policies={HEALTHY_SCHEDULE} />);

    const items = screen.getByTestId("dashboard-compensation-policy-list");
    expect(items).toHaveTextContent("comp_current");
    expect(items).toHaveTextContent("Active");
    expect(items).toHaveTextContent("comp_next");
    expect(items).toHaveTextContent("Scheduled");
    expect(items).toHaveTextContent(daysFromNow(-30));
  });

  it("blocks scheduling and explains a backdated pending revision", () => {
    render(
      <DashboardCompensationPolicyCheck
        policies={[policy({ id: "comp_backdated", effectiveDate: daysFromNow(-2) })]}
      />,
    );

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-status", "invalid");
    expect(panel).toHaveAttribute("data-can-schedule", "false");
    expect(panel).toHaveAttribute("data-error-count", "1");
    expect(screen.getByText("Action Required")).toBeInTheDocument();

    const finding = screen.getByTestId(
      "dashboard-compensation-policy-error-effective-date-in-past",
    );
    expect(finding).toHaveTextContent("Effective date in the past");
    expect(finding).toHaveTextContent("comp_backdated");
    expect(finding).toHaveTextContent("cannot be backdated");
    expect(finding).toHaveTextContent("Next step:");
  });

  it("lists every blocking finding for an unusable schedule", () => {
    render(
      <DashboardCompensationPolicyCheck
        policies={[
          policy({ id: "comp_a", effectiveDate: "2026-02-30" }),
          policy({ id: "comp_b", effectiveDate: "10/15/2026" }),
        ]}
      />,
    );

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-error-count", "2");
    expect(
      screen.getByTestId("dashboard-compensation-policy-error"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 effective-date problems found/i),
    ).toBeInTheDocument();
  });

  it("flags overlapping policy windows against the active revision", () => {
    render(
      <DashboardCompensationPolicyCheck
        policies={[
          policy({ id: "comp_current", effectiveDate: daysFromNow(40), status: "active" }),
          policy({ id: "comp_early", effectiveDate: daysFromNow(10) }),
        ]}
      />,
    );

    const finding = screen.getByTestId(
      "dashboard-compensation-policy-error-effective-date-before-active",
    );
    expect(finding).toHaveTextContent("Overlapping policy window");
    expect(finding).toHaveTextContent("comp_current");
  });

  it("flags duplicate effective dates on every colliding revision", () => {
    render(
      <DashboardCompensationPolicyCheck
        policies={[
          policy({ id: "comp_a", effectiveDate: daysFromNow(10) }),
          policy({ id: "comp_b", effectiveDate: daysFromNow(10) }),
        ]}
      />,
    );

    // Both revisions are flagged so the operator sees the full collision, not
    // just the first pair member.
    const findings = screen.getAllByTestId(
      "dashboard-compensation-policy-error-effective-date-duplicate",
    );
    expect(findings).toHaveLength(2);
    findings.forEach((finding) => {
      expect(finding).toHaveTextContent("comp_a, comp_b");
    });
  });

  it("warns without blocking when an effective date is beyond the horizon", () => {
    render(
      <DashboardCompensationPolicyCheck
        policies={[policy({ id: "comp_far", effectiveDate: daysFromNow(900) })]}
      />,
    );

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-status", "warning");
    expect(panel).toHaveAttribute("data-can-schedule", "true");
    expect(panel).toHaveAttribute("data-warning-count", "1");
    expect(screen.getByText("Notice")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-compensation-policy")).toHaveTextContent(
      /beyond the 400-day scheduling horizon/i,
    );
  });

  it("blocks safely when nothing is scheduled", () => {
    render(<DashboardCompensationPolicyCheck policies={[]} />);

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-status", "invalid");
    expect(screen.getByText(/no compensation policy revisions are scheduled/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-compensation-policy-list"),
    ).not.toBeInTheDocument();
  });

  it("blocks safely when the schedule is null or malformed", () => {
    const { rerender } = render(
      <DashboardCompensationPolicyCheck policies={null} />,
    );
    expect(screen.getByTestId("dashboard-compensation-policy")).toHaveAttribute(
      "data-status",
      "invalid",
    );

    rerender(
      <DashboardCompensationPolicyCheck
        policies={[
          null as unknown as CompensationPolicyScheduleEntry,
          { id: "comp_ok", effectiveDate: daysFromNow(5), status: "scheduled" },
        ]}
      />,
    );
    // The unreadable row is reported, but the healthy revision is still listed.
    expect(screen.getByTestId("dashboard-compensation-policy")).toHaveTextContent(
      "comp_ok",
    );
    expect(
      screen.getByTestId("dashboard-compensation-policy-error-policy-entry-invalid"),
    ).toBeInTheDocument();
  });

  it("links to the compensation policy editor when action is required", () => {
    render(<DashboardCompensationPolicyCheck policies={[]} />);

    const link = screen.getByRole("link", {
      name: /Review compensation policy schedule/i,
    });
    expect(link).toHaveAttribute("href", "/settings/payroll-policy");
  });

  it("calls onReviewClick instead of navigating when provided", () => {
    const handleReview = vi.fn();
    render(
      <DashboardCompensationPolicyCheck
        policies={[]}
        onReviewClick={handleReview}
      />,
    );

    fireEvent.click(
      screen.getByRole("link", { name: /Review compensation policy schedule/i }),
    );
    expect(handleReview).toHaveBeenCalledTimes(1);
  });

  it("falls back to a relative demo schedule when no prop is supplied", () => {
    render(<DashboardCompensationPolicyCheck />);

    const panel = screen.getByTestId("dashboard-compensation-policy");
    expect(panel).toHaveAttribute("data-status", "valid");
    expect(panel).toHaveAttribute("data-can-schedule", "true");
    expect(panel).toHaveTextContent("comp_policy_current");
    expect(panel).toHaveTextContent("comp_policy_next");
  });

  it("keeps the demo schedule healthy regardless of the current date", () => {
    vi.useFakeTimers();
    try {
      // Leap day, to confirm the demo schedule does not build an impossible date.
      vi.setSystemTime(new Date("2028-02-29T12:00:00.000Z"));
      render(<DashboardCompensationPolicyCheck />);
      expect(screen.getByTestId("dashboard-compensation-policy")).toHaveAttribute(
        "data-status",
        "valid",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("exposes accessible landmarks and a heading", () => {
    render(<DashboardCompensationPolicyCheck policies={HEALTHY_SCHEDULE} />);

    const section = screen.getByRole("status");
    expect(section).toHaveAttribute(
      "aria-labelledby",
      "dashboard-compensation-policy-heading",
    );
    expect(
      screen.getByRole("heading", {
        name: /Compensation policy effective dates/i,
        level: 3,
      }),
    ).toBeInTheDocument();
  });

  it("is mounted in the dashboard composition root inside an error boundary", () => {
    // DashboardHome is wallet-gated and not renderable in jsdom, so assert the
    // wiring directly: the panel must be mounted and wrapped in an ErrorBoundary
    // so a malformed schedule can never take the dashboard down.
    const source = readFileSync(
      join(process.cwd(), "components/features/dashboard/DashboardHome.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import DashboardCompensationPolicyCheck from "@/components/features/dashboard/DashboardCompensationPolicyCheck"',
    );
    expect(source).toMatch(
      /<ErrorBoundary>\s*<DashboardCompensationPolicyCheck \/>\s*<\/ErrorBoundary>/,
    );
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmployerOnboardingTimelineItem, EmployerOnboardingTimeline } from "@/components/features/activity/EmployerOnboardingTimelineItem";
import { emitEmployerOnboardingEvent } from "@/lib/events/employerOnboarding";
import { generateIncidentTimeline } from "@/src/observability/timeline";
import { clearEventStore } from "@/src/observability/emitter";

describe("EmployerOnboardingTimelineItem", () => {
  it("renders completed state with success message (success path)", () => {
    render(
      <EmployerOnboardingTimelineItem
        employerId="company_001"
        employerName="ZK Payroll Inc."
        state="completed"
        currentStep="verification_completed"
        timestamp="2025-01-15T10:00:00Z"
      />
    );
    expect(screen.getByTestId("employer-onboarding-timeline-item")).toBeInTheDocument();
    expect(screen.getByText(/ZK Payroll Inc\./)).toBeInTheDocument();
    expect(screen.getByText(/Onboarding completed/)).toBeInTheDocument();
    expect(screen.getByText(/Setup verified/)).toBeInTheDocument();
    // Privacy: no salary or amount
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument();
  });

  it("renders failed state with error detail (failure path)", () => {
    render(
      <EmployerOnboardingTimelineItem
        employerId="company_002"
        employerName="Failed Co"
        state="failed"
        currentStep="treasury_configured"
        errorMessage="Treasury verification failed"
      />
    );
    expect(screen.getByText(/Onboarding failed/)).toBeInTheDocument();
    expect(screen.getByText("Treasury verification failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders empty state for no items (edge case)", () => {
    render(<EmployerOnboardingTimeline items={[]} />);
    expect(screen.getByTestId("employer-onboarding-empty")).toBeInTheDocument();
    expect(screen.getByText(/No employer onboarding activity/)).toBeInTheDocument();
  });

  it("derives display from observability event entry", () => {
    clearEventStore();
    const evt = emitEmployerOnboardingEvent({
      employerId: "company_003",
      employerName: "Observability Co",
      step: "contracts_deployed",
      status: "succeeded",
      correlationId: "employer_company_003",
    });
    const timeline = generateIncidentTimeline("employer_company_003", [evt]);
    const entry = timeline.entries[0];
    render(
      <EmployerOnboardingTimelineItem
        employerId="company_003"
        employerName="Observability Co"
        state="not_started"
        entry={entry}
      />
    );
    expect(screen.getByText(/Observability Co/)).toBeInTheDocument();
    expect(screen.getByText(/Onboarding completed/)).toBeInTheDocument();
  });

  it("never exposes private payroll values in DOM", () => {
    const { container } = render(
      <EmployerOnboardingTimelineItem
        employerId="company_004"
        employerName="Privacy Check"
        state="in_progress"
        currentStep="company_created"
      />
    );
    expect(container.textContent).not.toMatch(/5000/);
    expect(container.textContent).not.toMatch(/\$\d/);
  });
});

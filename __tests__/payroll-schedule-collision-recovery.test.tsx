import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import PayrollScheduleCollisionDetector from "@/components/features/payroll/PayrollScheduleCollisionDetector";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";
import type { PayrollTemplate } from "@/types/models";

const TEMPLATE_A: PayrollTemplate = {
  id: "tpl_alpha",
  companyId: "company_001",
  name: "Core Engineering",
  description: "",
  frequency: "monthly",
  employeeIds: ["emp_001"],
  dayOfMonth: 15,
  isActive: true,
  lastExecuted: null,
  nextScheduled: "2025-01-15T09:00:00Z",
  createdAt: "2024-06-01T00:00:00Z",
  updatedAt: "2024-06-01T00:00:00Z",
  createdBy: "test",
};

const TEMPLATE_B: PayrollTemplate = {
  ...TEMPLATE_A,
  id: "tpl_beta",
  name: "Contractors",
  frequency: "biweekly",
  dayOfMonth: undefined,
  nextScheduled: "2025-01-20T09:00:00Z",
};

describe("PayrollScheduleCollisionDetector", () => {
  beforeEach(() => {
    useDraftScheduleWindowStore.setState({ drafts: [] });
  });

  it("renders healthy banner when no boundary collisions exist", () => {
    render(
      <PayrollScheduleCollisionDetector
        templates={[TEMPLATE_A, TEMPLATE_B]}
        showEditor={false}
      />,
    );

    expect(screen.getByTestId("boundary-healthy-banner")).toBeInTheDocument();
    expect(screen.getByText("Period Boundaries Aligned")).toBeInTheDocument();
    expect(screen.queryByTestId("boundary-collision-alert")).not.toBeInTheDocument();
  });

  it("detects and displays boundary collisions between overlapping draft windows", () => {
    useDraftScheduleWindowStore.setState({
      drafts: [
        {
          id: "draft_1",
          templateId: "tpl_alpha",
          windowStart: "2025-03-01",
          windowEnd: "2025-03-15",
          createdAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "draft_2",
          templateId: "tpl_beta",
          windowStart: "2025-03-10",
          windowEnd: "2025-03-25",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    render(
      <PayrollScheduleCollisionDetector
        templates={[TEMPLATE_A, TEMPLATE_B]}
        showEditor={false}
      />,
    );

    const alert = screen.getByTestId("boundary-collision-alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Boundary Collisions Detected/i);
    expect(screen.getByTestId("boundary-collision-item-draft_1")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-collision-item-draft_2")).toBeInTheDocument();
  });

  it("resolves single boundary collision when Apply Recovery is clicked", () => {
    useDraftScheduleWindowStore.setState({
      drafts: [
        {
          id: "draft_1",
          templateId: "tpl_alpha",
          windowStart: "2025-03-01",
          windowEnd: "2025-03-15",
          createdAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "draft_2",
          templateId: "tpl_beta",
          windowStart: "2025-03-10",
          windowEnd: "2025-03-20",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    render(
      <PayrollScheduleCollisionDetector
        templates={[TEMPLATE_A, TEMPLATE_B]}
        showEditor={false}
      />,
    );

    // Click Apply Recovery on draft_2
    const recoverBtn = screen.getByTestId("recover-btn-draft_2");
    fireEvent.click(recoverBtn);

    // draft_2 should be shifted past draft_1's end (March 15 -> March 16)
    const updatedDraft2 = useDraftScheduleWindowStore
      .getState()
      .drafts.find((d) => d.id === "draft_2");
    expect(updatedDraft2?.windowStart).toBe("2025-03-16");
    expect(updatedDraft2?.windowEnd).toBe("2025-03-26");
  });

  it("removes draft window when Remove is clicked", () => {
    useDraftScheduleWindowStore.setState({
      drafts: [
        {
          id: "draft_1",
          templateId: "tpl_alpha",
          windowStart: "2025-03-01",
          windowEnd: "2025-03-15",
          createdAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "draft_2",
          templateId: "tpl_beta",
          windowStart: "2025-03-10",
          windowEnd: "2025-03-20",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    render(
      <PayrollScheduleCollisionDetector
        templates={[TEMPLATE_A, TEMPLATE_B]}
        showEditor={false}
      />,
    );

    fireEvent.click(screen.getByTestId("remove-draft-btn-draft_2"));

    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(1);
    expect(screen.queryByTestId("boundary-collision-item-draft_2")).not.toBeInTheDocument();
  });

  it("resolves all collisions at once when Auto-Recover All is clicked", () => {
    useDraftScheduleWindowStore.setState({
      drafts: [
        {
          id: "draft_1",
          templateId: "tpl_alpha",
          windowStart: "2025-04-01",
          windowEnd: "2025-04-10",
          createdAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "draft_2",
          templateId: "tpl_beta",
          windowStart: "2025-04-05",
          windowEnd: "2025-04-12",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    render(
      <PayrollScheduleCollisionDetector
        templates={[TEMPLATE_A, TEMPLATE_B]}
        showEditor={false}
      />,
    );

    fireEvent.click(screen.getByTestId("auto-recover-all-btn"));

    // Check that drafts in store no longer collide
    const drafts = useDraftScheduleWindowStore.getState().drafts;
    const d1 = drafts.find((d) => d.id === "draft_1")!;
    const d2 = drafts.find((d) => d.id === "draft_2")!;

    expect(d2.windowStart >= d1.windowEnd || d1.windowStart >= d2.windowEnd).toBe(true);
  });
});

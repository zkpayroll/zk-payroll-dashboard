import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActivePeriodConflictWarning from "@/src/components/payroll/ActivePeriodConflictWarning";
import PayrollCorrectionPermissionNotice from "@/src/components/payroll/PayrollCorrectionPermissionNotice";
import DuplicateExecutionPreventionMessage from "@/src/components/payroll/DuplicateExecutionPreventionMessage";
import EmployerConfigurationRevisionHistory from "@/src/components/payroll/EmployerConfigurationRevisionHistory";

describe("ActivePeriodConflictWarning", () => {
  it("renders alert with conflict details", () => {
    render(
      <ActivePeriodConflictWarning
        periodId="period_001"
        conflictingPeriodId="period_002"
        conflictReason="Another period is currently active"
      />,
    );

    expect(screen.getByTestId("active-period-conflict-warning")).toBeInTheDocument();
    expect(screen.getByText("Active payroll period conflict")).toBeInTheDocument();
    expect(screen.getByText("Another period is currently active")).toBeInTheDocument();
    expect(screen.getByText(/period_001/)).toBeInTheDocument();
    expect(screen.getByText(/period_002/)).toBeInTheDocument();
  });

  it("dismisses when close button is clicked", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <ActivePeriodConflictWarning
        periodId="period_001"
        conflictingPeriodId="period_002"
        conflictReason="Another period is currently active"
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = container.querySelector(
      'button[aria-label="Dismiss warning"]',
    );
    fireEvent.click(dismissButton!);

    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByTestId("active-period-conflict-warning")).not.toBeInTheDocument();
  });

  it("calls onAction when action button is clicked", () => {
    const onAction = vi.fn();
    render(
      <ActivePeriodConflictWarning
        periodId="period_001"
        conflictingPeriodId="period_002"
        conflictReason="Another period is currently active"
        actionLabel="Resolve conflict"
        onAction={onAction}
      />,
    );

    const actionButton = screen.getByText("Resolve conflict");
    fireEvent.click(actionButton);

    expect(onAction).toHaveBeenCalled();
  });
});

describe("PayrollCorrectionPermissionNotice", () => {
  const mockPermissions = [
    {
      permission: "payroll:correct",
      description: "Ability to create corrections",
      required: true,
    },
    {
      permission: "audit:view",
      description: "Ability to view audit logs",
      required: false,
    },
  ];

  it("renders notice with permission details", () => {
    render(
      <PayrollCorrectionPermissionNotice
        userRole="admin"
        hasPermission={true}
        requiredPermissions={mockPermissions}
      />,
    );

    expect(screen.getByTestId("payroll-correction-permission-notice")).toBeInTheDocument();
    expect(screen.getByText("Payroll correction authorized")).toBeInTheDocument();
    expect(screen.getByText(/admin/)).toBeInTheDocument();
  });

  it("displays different message when permission is denied", () => {
    render(
      <PayrollCorrectionPermissionNotice
        userRole="operator"
        hasPermission={false}
        requiredPermissions={mockPermissions}
      />,
    );

    expect(screen.getByText("Payroll correction restricted")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Contact your administrator to request payroll correction permissions/,
      ),
    ).toBeInTheDocument();
  });

  it("expands permission details when chevron is clicked", () => {
    render(
      <PayrollCorrectionPermissionNotice
        userRole="admin"
        hasPermission={true}
        requiredPermissions={mockPermissions}
      />,
    );

    const expandButton = screen.getByLabelText("Expand details");
    expect(screen.queryByText("payroll:correct")).not.toBeInTheDocument();

    fireEvent.click(expandButton);

    expect(screen.getByText("payroll:correct")).toBeInTheDocument();
    expect(screen.getByText("Ability to create corrections")).toBeInTheDocument();
  });

  it("dismisses when close button is clicked", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <PayrollCorrectionPermissionNotice
        userRole="admin"
        hasPermission={true}
        requiredPermissions={mockPermissions}
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = container.querySelector(
      'button[aria-label="Dismiss notice"]',
    );
    fireEvent.click(dismissButton!);

    expect(onDismiss).toHaveBeenCalled();
    expect(
      screen.queryByTestId("payroll-correction-permission-notice"),
    ).not.toBeInTheDocument();
  });
});

describe("DuplicateExecutionPreventionMessage", () => {
  it("renders message with execution details", () => {
    render(
      <DuplicateExecutionPreventionMessage
        payrollId="payroll_001"
        previousExecutionTime="2024-01-15T10:30:00Z"
        previousExecutionHash="abc123def456"
        preventionReason="This payroll was already executed once"
      />,
    );

    expect(screen.getByTestId("duplicate-execution-prevention-message")).toBeInTheDocument();
    expect(screen.getByText("Duplicate execution detected")).toBeInTheDocument();
    expect(screen.getByText(/This payroll was already executed once/)).toBeInTheDocument();
    expect(screen.getByText(/payroll_001/)).toBeInTheDocument();
  });

  it("copies hash to clipboard when copy button is clicked", () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <DuplicateExecutionPreventionMessage
        payrollId="payroll_001"
        previousExecutionTime="2024-01-15T10:30:00Z"
        previousExecutionHash="abc123def456"
        preventionReason="This payroll was already executed once"
      />,
    );

    const copyButton = screen.getByTitle("Copy hash");
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith("abc123def456");
  });

  it("calls onViewPrevious when view previous button is clicked", () => {
    const onViewPrevious = vi.fn();
    render(
      <DuplicateExecutionPreventionMessage
        payrollId="payroll_001"
        previousExecutionTime="2024-01-15T10:30:00Z"
        preventionReason="This payroll was already executed once"
        onViewPrevious={onViewPrevious}
      />,
    );

    const viewButton = screen.getByText("View previous");
    fireEvent.click(viewButton);

    expect(onViewPrevious).toHaveBeenCalled();
  });

  it("dismisses when close button is clicked", () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <DuplicateExecutionPreventionMessage
        payrollId="payroll_001"
        previousExecutionTime="2024-01-15T10:30:00Z"
        preventionReason="This payroll was already executed once"
        onDismiss={onDismiss}
      />,
    );

    const dismissButton = container.querySelector(
      'button[aria-label="Dismiss message"]',
    );
    fireEvent.click(dismissButton!);

    expect(onDismiss).toHaveBeenCalled();
    expect(
      screen.queryByTestId("duplicate-execution-prevention-message"),
    ).not.toBeInTheDocument();
  });
});

describe("EmployerConfigurationRevisionHistory", () => {
  const mockRevisions = [
    {
      id: "rev_001",
      timestamp: "2024-01-15T10:30:00Z",
      changedBy: "admin@example.com",
      changeType: "created" as const,
      version: 1,
      changes: [
        {
          field: "Company Name",
          oldValue: null,
          newValue: "Acme Corp",
        },
      ],
    },
    {
      id: "rev_002",
      timestamp: "2024-01-16T14:45:00Z",
      changedBy: "manager@example.com",
      changeType: "updated" as const,
      version: 2,
      reason: "Updated treasury address",
      changes: [
        {
          field: "Treasury Address",
          oldValue: "GA1234567890",
          newValue: "GA9876543210",
        },
      ],
    },
  ];

  it("renders revision history list", () => {
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
      />,
    );

    expect(screen.getByTestId("employer-config-revision-history")).toBeInTheDocument();
    expect(screen.getByText("Configuration Revision History")).toBeInTheDocument();
    expect(screen.getByText(/2 revisions/)).toBeInTheDocument();
  });

  it("displays empty state when no revisions", () => {
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={[]}
      />,
    );

    expect(screen.getByTestId("empty-revision-history")).toBeInTheDocument();
    expect(screen.getByText("No revision history")).toBeInTheDocument();
  });

  it("expands revision details when clicked", () => {
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
      />,
    );

    expect(screen.queryByText("Company Name")).not.toBeInTheDocument();

    const expandButtons = screen.getAllByRole("button");
    fireEvent.click(expandButtons[0]);

    expect(screen.getByText("Company Name")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("calls onViewDetails when view full details is clicked", () => {
    const onViewDetails = vi.fn();
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
        onViewDetails={onViewDetails}
      />,
    );

    const expandButtons = screen.getAllByRole("button");
    fireEvent.click(expandButtons[0]);

    const detailsButton = screen.getByText("View full details");
    fireEvent.click(detailsButton);

    expect(onViewDetails).toHaveBeenCalledWith(mockRevisions[0]);
  });

  it("calls onExport when export button is clicked", () => {
    const onExport = vi.fn();
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
        onExport={onExport}
      />,
    );

    const exportButtons = screen.getAllByTitle("Export revision");
    fireEvent.click(exportButtons[0]);

    expect(onExport).toHaveBeenCalledWith(mockRevisions[0]);
  });

  it("displays change type badges correctly", () => {
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
      />,
    );

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("displays reason when provided", () => {
    render(
      <EmployerConfigurationRevisionHistory
        companyId="company_001"
        revisions={mockRevisions}
      />,
    );

    expect(screen.getByText("Updated treasury address")).toBeInTheDocument();
  });
});

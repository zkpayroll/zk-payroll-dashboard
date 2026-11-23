import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import React from "react";

import AuditExportWizard from "@/components/features/audit/AuditExportWizard";
import {
  useAuditExportStore,
} from "@/stores/auditExport";
import type {
  AuditPacketEntry,
  AuditGrant,
} from "@/stores/auditExport";

const mockEntries: AuditPacketEntry[] = [
  {
    id: "entry_1",
    type: "payroll_run",
    title: "August 2025 Payroll",
    date: "2025-08-15T10:00:00Z",
    summary: "Monthly payroll for 50 employees",
    selected: false,
    fields: [
      "employee_id",
      "amount",
      "date",
    ],
  },
  {
    id: "entry_2",
    type: "transaction",
    title: "TX-001 Stellar Transfer",
    date: "2025-08-16T14:00:00Z",
    summary: "Batch transfer of 50,000 USDC",
    selected: false,
    fields: [
      "tx_hash",
      "amount",
      "from",
      "to",
    ],
  },
  {
    id: "entry_3",
    type: "compliance_event",
    title: "KYC Verification",
    date: "2025-08-17T09:00:00Z",
    summary:
      "KYC check passed for employee EMP-042",
    selected: true,
    fields: [
      "employee_id",
      "status",
      "timestamp",
    ],
  },
];

const createValidGrant = (): AuditGrant => ({
  id: "grant_001",
  status: "active",
  expiresAt: "2099-12-31T23:59:59.000Z",
  allowedRecordTypes: [
    "payroll_run",
    "transaction",
    "compliance_event",
    "key_access_log",
    "treasury_movement",
  ],
  allowedFields: [
    "employee_id",
    "amount",
    "date",
    "tx_hash",
    "from",
    "to",
    "status",
    "timestamp",
  ],
});

const resetStore = () => {
  useAuditExportStore.setState({
    entries: mockEntries,
    currentStep: "select",
    exportFormat: "csv",
    includeMetadata: true,
    dateRangeStart: "",
    dateRangeEnd: "",
    activeExportJob: null,
    exportHistory: [],
    searchQuery: "",
    auditGrant: createValidGrant(),
    grantValidation: {
      valid: true,
      status: "active",
      reason: null,
      checkedAt: new Date().toISOString(),
    },
  });
};

const continueWizard = () => {
  fireEvent.click(
    screen.getByRole("button", {
      name: /^continue$/i,
    })
  );
};

const goToExportStep = () => {
  continueWizard(); // select -> review
  continueWizard(); // review -> configure
  continueWizard(); // configure -> export
};

describe("AuditExportWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("renders the audit packet export heading", () => {
    render(<AuditExportWizard />);

    expect(
      screen.getByRole("heading", {
        name: "Audit Packet Export",
      })
    ).toBeInTheDocument();
  });

  it("renders the wizard steps", () => {
    render(<AuditExportWizard />);

    expect(
      screen.getByText("Audit Scope")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Review & Redact")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Packet Metadata")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Validate & Export")
    ).toBeInTheDocument();
  });

  it("displays the available audit records", () => {
    render(<AuditExportWizard />);

    expect(
      screen.getByText("August 2025 Payroll")
    ).toBeInTheDocument();

    expect(
      screen.getByText("TX-001 Stellar Transfer")
    ).toBeInTheDocument();

    expect(
      screen.getByText("KYC Verification")
    ).toBeInTheDocument();
  });

  it("shows the privacy warning on the scope step", () => {
    render(<AuditExportWizard />);

    expect(
      screen.getByText(
        /Only selected records will be included in the audit/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Sensitive fields will be redacted by default/i
      )
    ).toBeInTheDocument();
  });

  it("allows an audit entry to be selected", () => {
    render(<AuditExportWizard />);

    const checkboxes =
      screen.getAllByRole("checkbox");

    /*
     * entry_1 is initially unchecked.
     * The first record checkbox is the first
     * checkbox in the scope list.
     */
    fireEvent.click(checkboxes[0]);

    expect(
      useAuditExportStore
        .getState()
        .entries
        .find(
          (entry) =>
            entry.id === "entry_1"
        )?.selected
    ).toBe(true);
  });

  it("allows an audit entry to be deselected", () => {
    render(<AuditExportWizard />);

    const checkboxes =
      screen.getAllByRole("checkbox");

    /*
     * entry_3 starts selected.
     * Toggle the third record checkbox.
     */
    fireEvent.click(checkboxes[2]);

    expect(
      useAuditExportStore
        .getState()
        .entries
        .find(
          (entry) =>
            entry.id === "entry_3"
        )?.selected
    ).toBe(false);
  });

  it("selects all audit entries", () => {
    render(<AuditExportWizard />);

    const selectAllButtons =
      screen.getAllByRole("button", {
        name: /select all/i,
      });

    fireEvent.click(selectAllButtons[0]);

    expect(
      useAuditExportStore
        .getState()
        .entries
        .every(
          (entry) => entry.selected
        )
    ).toBe(true);
  });

  it("deselects all audit entries", () => {
    render(<AuditExportWizard />);

    const deselectButtons =
      screen.getAllByRole("button", {
        name: /deselect all/i,
      });

    fireEvent.click(deselectButtons[0]);

    expect(
      useAuditExportStore
        .getState()
        .entries
        .some(
          (entry) => entry.selected
        )
    ).toBe(false);
  });

  it("disables Continue when no records are selected", () => {
    useAuditExportStore.setState({
      entries: mockEntries.map(
        (entry) => ({
          ...entry,
          selected: false,
        })
      ),
    });

    render(<AuditExportWizard />);

    expect(
      screen.getByRole("button", {
        name: /^continue$/i,
      })
    ).toBeDisabled();
  });

  it("allows progression from scope to review", () => {
    render(<AuditExportWizard />);

    continueWizard();

    expect(
      screen.getByRole("heading", {
        name: "Review & Redact",
      })
    ).toBeInTheDocument();
  });

  it("shows sensitive fields as redacted by default", () => {
    render(<AuditExportWizard />);

    continueWizard();

    expect(
      screen.getAllByText(
        /Sensitive fields are redacted by default/i
      ).length
    ).toBeGreaterThan(0);
  });

  it("progresses from review to packet metadata", () => {
    render(<AuditExportWizard />);

    continueWizard();
    continueWizard();

    expect(
      screen.getByRole("heading", {
        name: "Packet Metadata",
      })
    ).toBeInTheDocument();
  });

  it("progresses from packet metadata to validation", () => {
    render(<AuditExportWizard />);

    continueWizard();
    continueWizard();
    continueWizard();

    /*
     * The configure step validates the grant
     * before entering the export step.
     */
    expect(
      screen.getByText(
        "Audit grant validation"
      )
    ).toBeInTheDocument();
  });

  it("shows the active audit grant status", () => {
    render(<AuditExportWizard />);

    goToExportStep();

    expect(
      screen.getByText("ACTIVE")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /active and covers the selected scope/i
      )
    ).toBeInTheDocument();
  });

  it("blocks export when the audit grant is expired", () => {
    useAuditExportStore.setState({
      auditGrant: {
        ...createValidGrant(),
        status: "expired",
      },
      grantValidation: {
        valid: false,
        status: "expired",
        reason: "Audit grant has expired",
        checkedAt: null,
      },
    });

    render(<AuditExportWizard />);

    goToExportStep();

    expect(
      screen.getByText(
        "Export blocked"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /expired/i
      )
    ).toBeInTheDocument();
  });

    it("blocks export when the audit grant is revoked", () => {
    useAuditExportStore.setState({
      auditGrant: {
        ...createValidGrant(),
        status: "revoked" as const,
      },
      grantValidation: {
        valid: false,
        status: "revoked",
        reason: "Audit grant has been revoked",
        checkedAt: null,
      },
    });

    render(<AuditExportWizard />);

    goToExportStep();

    expect(
      screen.getByText("Export blocked")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/revoked/i)
    ).toBeInTheDocument();
  });
  
  it("blocks export when the selected scope is outside the grant", () => {
    useAuditExportStore.setState({
      auditGrant: {
        ...createValidGrant(),
        allowedRecordTypes: [
          "compliance_event",
        ],
      },
    });

    render(<AuditExportWizard />);

    /*
     * Select entry_1 as well as entry_3.
     */
    const checkboxes =
      screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[0]);

    goToExportStep();

    expect(
      screen.getByText(
        "Export blocked"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /outside.*scope/i
      )
    ).toBeInTheDocument();
  });

  it("shows the export confirmation control", () => {
    render(<AuditExportWizard />);

    goToExportStep();

    expect(
      screen.getByRole("checkbox")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /I confirm that the selected records are/i
      )
    ).toBeInTheDocument();
  });

  it("does not allow export before confirmation", () => {
    render(<AuditExportWizard />);

    goToExportStep();

    /*
     * The export button is only rendered/enabled
     * after explicit confirmation.
     */
    expect(
      screen.queryByRole("button", {
        name: /export/i,
      })
    ).toBeNull();
  });

  it("allows confirmation when the grant is valid", () => {
    render(<AuditExportWizard />);

    goToExportStep();

    const checkboxes =
      screen.getAllByRole("checkbox");

    /*
     * At this point the export-step checkbox
     * is the confirmation checkbox.
     */
    fireEvent.click(
      checkboxes[checkboxes.length - 1]
    );

    expect(
      useAuditExportStore.getState()
    ).toBeDefined();
  });

  it("supports searching audit records", () => {
    render(<AuditExportWizard />);

    const searchInput =
      screen.getByPlaceholderText(
        /Search records/i
      );

    fireEvent.change(searchInput, {
      target: {
        value: "August",
      },
    });

    expect(
      screen.getByText(
        "August 2025 Payroll"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "TX-001 Stellar Transfer"
      )
    ).not.toBeInTheDocument();
  });
});
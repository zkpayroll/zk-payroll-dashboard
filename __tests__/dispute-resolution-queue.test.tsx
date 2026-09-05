import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DisputeResolutionQueue from "@/components/features/disputes/DisputeResolutionQueue";
import { useDisputesStore } from "@/stores/disputes";
import type { PayrollDispute } from "@/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const currentSession: {
  publicKey: string;
  role: "admin" | "operator" | "auditor";
  expiresAt: number;
} = {
  publicKey: "GADMIN1234567890abcdef1234567890abcdef1234567890abcdef1234",
  role: "admin",
  expiresAt: Date.now() + 86_400_000,
};

vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({
    sessionState: "active",
    sessionInfo: currentSession,
    timeRemaining: 86_400_000,
    formatTimeRemaining: () => "24h remaining",
    refresh: vi.fn(),
  }),
}));

const ACTIVE_DISPUTE: PayrollDispute = {
  id: "disp_test_active",
  payrollRunId: "run_test_001",
  payrollPeriod: "2026-Q3-July",
  payrollBatch: "batch_test_001",
  status: "active",
  raisedBy: "system",
  reason: "Compliance review required.",
  isResolved: false,
  resolutionDeadline: "2026-09-30T23:59:59Z",
  safeReasonCode: "compliance_hold",
  safeReasonDescription: "Compliance review required.",
  blockedActions: ["finalization", "reconciliation"],
  requiredReviewer: "admin",
  resolutionAction: "Complete compliance review.",
  createdAt: "2026-08-20T09:00:00Z",
};

const OVERDUE_DISPUTE: PayrollDispute = {
  id: "disp_test_overdue",
  payrollRunId: "run_test_002",
  payrollPeriod: "2026-Q3-August",
  payrollBatch: "batch_test_002",
  status: "overdue",
  raisedBy: "system",
  reason: "Awaiting executive approval.",
  isResolved: false,
  resolutionDeadline: "2026-08-20T23:59:59Z",
  safeReasonCode: "pending_approval",
  safeReasonDescription: "Awaiting executive approval.",
  blockedActions: ["execution"],
  requiredReviewer: "admin",
  resolutionAction: "Approve or reject pending approval.",
  createdAt: "2026-08-10T14:30:00Z",
};

const RESOLVED_DISPUTE: PayrollDispute = {
  id: "disp_test_resolved",
  payrollRunId: "run_test_003",
  payrollPeriod: "2026-Q2-June",
  payrollBatch: "batch_test_003",
  status: "resolved",
  raisedBy: "system",
  reason: "ZK proof verification failed.",
  isResolved: true,
  resolutionDeadline: "2026-07-15T23:59:59Z",
  safeReasonCode: "zk_proof_failed",
  safeReasonDescription: "ZK proof verification failed.",
  blockedActions: [],
  requiredReviewer: "admin",
  resolutionAction: "Proof regenerated.",
  createdAt: "2026-07-01T10:00:00Z",
  resolvedAt: "2026-07-12T16:45:00Z",
  resolvedBy: "admin_alice",
  resolutionNote: "ZK proof was regenerated.",
};

const BLOCKED_FINALIZATION_DISPUTE: PayrollDispute = {
  id: "disp_test_blocked_fin",
  payrollRunId: "run_test_004",
  payrollPeriod: "2026-Q3-August",
  payrollBatch: "batch_test_004",
  status: "active",
  raisedBy: "system",
  reason: "Treasury balance insufficient.",
  isResolved: false,
  resolutionDeadline: "2026-09-05T23:59:59Z",
  safeReasonCode: "insufficient_treasury",
  safeReasonDescription: "Treasury balance insufficient.",
  blockedActions: ["finalization", "execution"],
  requiredReviewer: "admin",
  resolutionAction: "Fund treasury.",
  createdAt: "2026-08-22T08:15:00Z",
};

function setDisputes(disputes: PayrollDispute[]) {
  useDisputesStore.setState({ disputes, isLoading: false, error: null });
}

describe("Dispute Resolution Queue (Issue #317)", () => {
  beforeEach(() => {
    currentSession.role = "admin";
    setDisputes([]);
  });

  it("shows empty queue when no disputes exist", () => {
    setDisputes([]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText("No disputes")).toBeInTheDocument();
  });

  it("renders active disputes with correct information", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText("2026-Q3-July")).toBeInTheDocument();
    expect(screen.getByText(/batch_test_001/)).toBeInTheDocument();
    expect(screen.getByText(/Compliance review required/)).toBeInTheDocument();
    expect(screen.getByText(/Complete compliance review/)).toBeInTheDocument();
  });

  it("renders overdue disputes with deadline warning", () => {
    setDisputes([OVERDUE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText("2026-Q3-August")).toBeInTheDocument();
    const statusBadge = screen.getByText("Overdue");
    expect(statusBadge).toBeInTheDocument();
  });

  it("renders resolved disputes with resolution note", () => {
    setDisputes([RESOLVED_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText("2026-Q2-June")).toBeInTheDocument();
    expect(screen.getByText("ZK proof was regenerated.")).toBeInTheDocument();
    expect(screen.getByText(/admin_alice/)).toBeInTheDocument();
  });

  it("shows blocked lifecycle actions with explanation", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText(/Blocked Lifecycle Actions/)).toBeInTheDocument();
    expect(screen.getAllByText(/Finalization/).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText(/Reconciliation is blocked/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be finalized/)).toBeInTheDocument();
  });

  it("shows correct dispute information rendering", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText("Dispute Resolution Queue")).toBeInTheDocument();
    expect(
      screen.getByText("Review and resolve blocked payroll disputes"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Required Reviewer/)).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows resolve and escalate buttons for authorized admin users", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(
      screen.getByRole("button", { name: /Resolve dispute/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Escalate dispute/ }),
    ).toBeInTheDocument();
  });

  it("does not show resolve/escalate for resolved disputes", () => {
    setDisputes([RESOLVED_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(
      screen.queryByRole("button", { name: /Resolve dispute/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Escalate dispute/ }),
    ).not.toBeInTheDocument();
  });

  it("filters to active disputes only", () => {
    setDisputes([ACTIVE_DISPUTE, OVERDUE_DISPUTE, RESOLVED_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const activeTab = screen.getByRole("tab", { name: /Active/ });
    fireEvent.click(activeTab);
    expect(screen.getByText("2026-Q3-July")).toBeInTheDocument();
    expect(screen.queryByText("2026-Q2-June")).not.toBeInTheDocument();
  });

  it("filters to overdue disputes only", () => {
    setDisputes([ACTIVE_DISPUTE, OVERDUE_DISPUTE, RESOLVED_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const overdueTab = screen.getByRole("tab", { name: /Overdue/ });
    fireEvent.click(overdueTab);
    expect(screen.getByText("2026-Q3-August")).toBeInTheDocument();
    expect(screen.queryByText("2026-Q3-July")).not.toBeInTheDocument();
  });

  it("filters to resolved disputes only", () => {
    setDisputes([ACTIVE_DISPUTE, OVERDUE_DISPUTE, RESOLVED_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const resolvedTab = screen.getByRole("tab", { name: /Resolved/ });
    fireEvent.click(resolvedTab);
    expect(screen.getByText("2026-Q2-June")).toBeInTheDocument();
    expect(screen.queryByText("2026-Q3-July")).not.toBeInTheDocument();
  });

  it("filters to blocked finalization disputes only", () => {
    setDisputes([
      ACTIVE_DISPUTE,
      OVERDUE_DISPUTE,
      BLOCKED_FINALIZATION_DISPUTE,
      RESOLVED_DISPUTE,
    ]);
    render(<DisputeResolutionQueue />);
    const blockedTab = screen.getByRole("tab", {
      name: /Blocked Finalization/,
    });
    fireEvent.click(blockedTab);
    expect(screen.getByText("2026-Q3-August")).toBeInTheDocument();
    expect(screen.queryByText("2026-Q2-June")).not.toBeInTheDocument();
  });

  it("resolves a dispute via the confirmation dialog", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const resolveBtn = screen.getByRole("button", { name: /Resolve dispute/ });
    fireEvent.click(resolveBtn);
    const dialogTitles = screen.getAllByText("Resolve Dispute");
    expect(dialogTitles.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Resolve the dispute for payroll period/),
    ).toBeInTheDocument();
  });

  it("escalates a dispute via the confirmation dialog", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const escalateBtn = screen.getByRole("button", {
      name: /Escalate dispute/,
    });
    fireEvent.click(escalateBtn);
    const dialogTitles = screen.getAllByText("Escalate Dispute");
    expect(dialogTitles.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Escalate the dispute for payroll period/),
    ).toBeInTheDocument();
  });

  it("shows role restriction for unauthorized users", () => {
    currentSession.role = "auditor";
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText(/Requires Admin role/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Resolve dispute/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Escalate dispute/ }),
    ).not.toBeInTheDocument();
  });

  it("allows operator to resolve operator-required disputes", () => {
    const operatorDispute: PayrollDispute = {
      ...ACTIVE_DISPUTE,
      id: "disp_operator",
      requiredReviewer: "operator",
    };
    currentSession.role = "operator";
    setDisputes([operatorDispute]);
    render(<DisputeResolutionQueue />);
    expect(
      screen.getByRole("button", { name: /Resolve dispute/ }),
    ).toBeInTheDocument();
  });

  it("prevents operator from resolving admin-required disputes", () => {
    currentSession.role = "operator";
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    expect(screen.getByText(/Requires Admin role/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Resolve dispute/ }),
    ).not.toBeInTheDocument();
  });

  it("shows filter counts correctly", () => {
    setDisputes([
      ACTIVE_DISPUTE,
      OVERDUE_DISPUTE,
      RESOLVED_DISPUTE,
      BLOCKED_FINALIZATION_DISPUTE,
    ]);
    render(<DisputeResolutionQueue />);
    expect(
      screen.getByRole("tab", { name: /All Disputes \(4\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Active \(2\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Overdue \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Resolved \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Blocked Finalization \(2\)/ }),
    ).toBeInTheDocument();
  });

  it("shows empty state when filter has no matches", () => {
    setDisputes([ACTIVE_DISPUTE]);
    render(<DisputeResolutionQueue />);
    const resolvedTab = screen.getByRole("tab", { name: /Resolved/ });
    fireEvent.click(resolvedTab);
    expect(screen.getByText(/No resolved disputes/)).toBeInTheDocument();
  });
});

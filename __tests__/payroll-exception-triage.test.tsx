import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PayrollExceptionTriage from "@/components/triage/PayrollExceptionTriage";
import type { PayrollTriageException } from "@/types/models";

const MOCK_TEST_EXCEPTIONS: PayrollTriageException[] = [
  {
    id: "exc_test_01",
    runId: "run_test_01",
    category: "zk_proof",
    severity: "blocking",
    status: "open",
    title: "Test Blocking ZK Failure",
    description: "Proof verification witness mismatch",
    source: "circuit_verifier",
    employeeCount: 2,
    affectedEmployees: [
      { id: "emp_1", name: "Alice", salaryCommitmentHash: "0xabc123... (Redacted)" },
    ],
    suggestedAction: "Regenerate proof in wizard",
    nextStepUrl: "/payroll",
    createdAt: "2025-02-28T10:00:00Z",
  },
  {
    id: "exc_test_02",
    runId: "run_test_02",
    category: "treasury",
    severity: "warning",
    status: "investigating",
    title: "Test Warning Treasury Low",
    description: "Balance is close to threshold",
    source: "treasury_guard",
    employeeCount: 5,
    suggestedAction: "Top up treasury balance",
    nextStepUrl: "/treasury",
    createdAt: "2025-02-28T11:00:00Z",
  },
  {
    id: "exc_test_03",
    runId: "run_test_03",
    category: "network",
    severity: "info",
    status: "resolved",
    title: "Test Info Horizon Retry",
    description: "Temporary RPC congestion resolved",
    source: "oracle_bridge",
    employeeCount: 1,
    suggestedAction: "No action needed",
    createdAt: "2025-02-28T09:00:00Z",
    resolvedAt: "2025-02-28T09:05:00Z",
  },
];

describe("PayrollExceptionTriage", () => {
  it("renders empty state when no exceptions provided", () => {
    render(<PayrollExceptionTriage initialExceptions={[]} />);
    expect(screen.getByText(/no payroll exceptions found/i)).toBeInTheDocument();
  });

  it("renders heading and summary counters", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    expect(screen.getByRole("heading", { name: /payroll exception triage/i })).toBeInTheDocument();
    expect(screen.getByText("Total Exceptions")).toBeInTheDocument();
    expect(screen.getByText("Blocking Errors")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getAllByText("Resolved").length).toBeGreaterThan(0);
  });

  it("visually distinguishes blocking exceptions from warnings", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const blockingBadge = screen.getByText("blocking");
    const warningBadge = screen.getByText("warning");

    expect(blockingBadge).toHaveClass("bg-red-100");
    expect(warningBadge).toHaveClass("bg-amber-100");
  });

  it("filters by severity when scorecard or dropdown selected", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const select = screen.getByLabelText(/severity/i);

    fireEvent.change(select, { target: { value: "blocking" } });
    expect(screen.getByText("Test Blocking ZK Failure")).toBeInTheDocument();
    expect(screen.queryByText("Test Warning Treasury Low")).not.toBeInTheDocument();
  });

  it("filters by source", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const select = screen.getByLabelText(/source/i);

    fireEvent.change(select, { target: { value: "treasury_guard" } });
    expect(screen.getByText("Test Warning Treasury Low")).toBeInTheDocument();
    expect(screen.queryByText("Test Blocking ZK Failure")).not.toBeInTheDocument();
  });

  it("filters by status", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const select = screen.getByLabelText(/status/i);

    fireEvent.change(select, { target: { value: "resolved" } });
    expect(screen.getByText("Test Info Horizon Retry")).toBeInTheDocument();
    expect(screen.queryByText("Test Blocking ZK Failure")).not.toBeInTheDocument();
  });

  it("searches exceptions by query", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const searchInput = screen.getByLabelText(/search exceptions/i);

    fireEvent.change(searchInput, { target: { value: "witness mismatch" } });
    expect(screen.getByText("Test Blocking ZK Failure")).toBeInTheDocument();
    expect(screen.queryByText("Test Warning Treasury Low")).not.toBeInTheDocument();
  });

  it("protects privacy by redacting sensitive salary commitments", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const privacyToggle = screen.getByRole("button", { name: /view privacy & recipient details/i });
    fireEvent.click(privacyToggle);

    expect(screen.getByText(/privacy redaction active/i)).toBeInTheDocument();
    expect(screen.getByText(/0xabc123\.\.\. \(redacted\)/i)).toBeInTheDocument();
  });

  it("transitions status when clicking action buttons", () => {
    render(<PayrollExceptionTriage initialExceptions={MOCK_TEST_EXCEPTIONS} />);
    const investigateBtn = screen.getByRole("button", { name: /investigate/i });
    fireEvent.click(investigateBtn);

    const resolveBtn = screen.getAllByRole("button", { name: /resolve/i })[0];
    fireEvent.click(resolveBtn);

    // After resolving, re-open button appears
    expect(screen.getAllByRole("button", { name: /re-open/i }).length).toBeGreaterThan(0);
  });
});

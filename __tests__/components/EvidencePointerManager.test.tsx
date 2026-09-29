import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import EvidencePointerManager from "@/components/features/compliance/EvidencePointerManager";
import { useEvidencePointerStore } from "@/stores/evidencePointers";
import {
  MOCK_COMPLIANCE_EVIDENCE_POINTERS,
  MOCK_COMPLIANCE_EVIDENCE_POINTERS_EMPTY,
} from "@/lib/api/mockData";

function fillForm({
  reviewCaseId,
  payrollRunId,
  reference,
  description,
}: {
  reviewCaseId: string;
  payrollRunId: string;
  reference: string;
  description: string;
}) {
  fireEvent.change(screen.getByLabelText(/review case id/i), {
    target: { value: reviewCaseId },
  });
  fireEvent.change(screen.getByLabelText(/payroll period/i), {
    target: { value: payrollRunId },
  });
  fireEvent.change(screen.getByLabelText(/^reference$/i), {
    target: { value: reference },
  });
  fireEvent.change(screen.getByLabelText(/description/i), {
    target: { value: description },
  });
}

describe("EvidencePointerManager", () => {
  beforeEach(() => {
    useEvidencePointerStore.setState({ pointers: MOCK_COMPLIANCE_EVIDENCE_POINTERS });
  });

  it("renders existing pointers grouped by review case", () => {
    render(<EvidencePointerManager />);

    expect(screen.getByRole("heading", { name: "case_2025_02_014" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "case_2025_03_002" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no pointers", () => {
    useEvidencePointerStore.setState({ pointers: MOCK_COMPLIANCE_EVIDENCE_POINTERS_EMPTY });

    render(<EvidencePointerManager />);

    expect(screen.getByText("No evidence pointers yet")).toBeInTheDocument();
  });

  it("never renders raw evidence content, only references and descriptions", () => {
    render(<EvidencePointerManager />);

    // The mock data's reference values (hashes, CIDs, case numbers) are fine to show —
    // what must never appear is anything resembling actual evidence content/body text.
    expect(screen.queryByText(/notarized pdf contents/i)).not.toBeInTheDocument();
  });

  it("disables submit until all required fields are filled", () => {
    render(<EvidencePointerManager />);

    const submitButton = screen.getByRole("button", { name: /add pointer/i });
    expect(submitButton).toBeDisabled();

    fillForm({
      reviewCaseId: "case_2025_04_001",
      payrollRunId: "tx_010",
      reference: "https://example.com/evidence",
      description: "A valid piece of evidence",
    });

    expect(submitButton).not.toBeDisabled();
  });

  it("adds a valid pointer and shows it under its review case", () => {
    render(<EvidencePointerManager />);

    fillForm({
      reviewCaseId: "case_2025_04_001",
      payrollRunId: "tx_010",
      reference: "https://example.com/evidence",
      description: "A valid piece of evidence",
    });
    fireEvent.click(screen.getByRole("button", { name: /add pointer/i }));

    expect(screen.getByRole("heading", { name: "case_2025_04_001" })).toBeInTheDocument();
    expect(screen.getByText("A valid piece of evidence")).toBeInTheDocument();
  });

  it("shows a validation error and marks the pointer invalid for a malformed URL", () => {
    render(<EvidencePointerManager />);

    fillForm({
      reviewCaseId: "case_2025_04_002",
      payrollRunId: "tx_011",
      reference: "not-a-valid-url",
      description: "Broken evidence link",
    });
    fireEvent.click(screen.getByRole("button", { name: /add pointer/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/not a valid URL/i);
  });

  it("filters pointers by review case", () => {
    render(<EvidencePointerManager />);

    fireEvent.change(screen.getByLabelText(/review case:/i), {
      target: { value: "case_2025_02_014" },
    });

    expect(screen.getByRole("heading", { name: "case_2025_02_014" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "case_2025_03_002" })).not.toBeInTheDocument();
  });
});

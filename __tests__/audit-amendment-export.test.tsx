import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  exportAmendmentMetadata,
  containsRawSalaryLeak,
} from "@/lib/privacy/amendments";
import { AuditAmendmentExportModal } from "@/components/features/audit/AuditAmendmentExportModal";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";

const mockAmendments: SalaryCommitmentAmendment[] = [
  {
    id: "amd_001",
    employeeReference: "EMP-101",
    period: "2025-06",
    asset: { code: "USDC", issuer: "G..." },
    commitmentVersion: 2,
    previousVersion: 1,
    previousCommitment: "0x11111111111111111111111111111111",
    nextCommitment: "0x22222222222222222222222222222222",
    approvalStatus: "approved",
    createdAt: "2025-06-01T10:00:00Z",
  },
];

describe("exportAmendmentMetadata unit tests", () => {
  it("exports JSON format containing safe metadata fields only", () => {
    const result = exportAmendmentMetadata(mockAmendments, "json");
    expect(result.contentType).toBe("application/json");
    expect(result.filename).toMatch(/\.json$/);

    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("amd_001");
    expect(parsed[0].employeeReference).toBe("EMP-101");
    expect(parsed[0].previousCommitment).toBe("0x11111111111111111111111111111111");
    expect(parsed[0].nextCommitment).toBe("0x22222222222222222222222222222222");
    expect(parsed[0].asset).toBe("USDC");

    // Assert raw salary leak is absent
    expect(containsRawSalaryLeak(result.data, [5000, 9500])).toBe(false);
  });

  it("exports CSV format containing header and safe metadata rows", () => {
    const result = exportAmendmentMetadata(mockAmendments, "csv");
    expect(result.contentType).toMatch(/text\/csv/);
    expect(result.filename).toMatch(/\.csv$/);

    expect(result.data).toContain("id,employeeReference,period,asset");
    expect(result.data).toContain('"amd_001"');
    expect(result.data).toContain('"EMP-101"');
  });
});

describe("AuditAmendmentExportModal component tests", () => {
  it("renders modal when isOpen is true", () => {
    render(
      <AuditAmendmentExportModal
        isOpen={true}
        amendments={mockAmendments}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("audit-amendment-export-modal")).toBeInTheDocument();
    expect(screen.getByText("Audit-Friendly Amendment Export")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-export-privacy-notice")).toBeInTheDocument();
  });

  it("toggles preview mode when clicking Review Preview", () => {
    render(
      <AuditAmendmentExportModal
        isOpen={true}
        amendments={mockAmendments}
        onClose={vi.fn()}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /Review Preview/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/amd_001 · EMP-101/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttestationDigestViewer from "@/components/features/audit/AttestationDigestViewer";
import { validateDigestMetadata } from "@/types/audit";
import type { AttestationDigestMetadata } from "@/types/audit";

const VERIFIED_DIGEST: AttestationDigestMetadata = {
  digest: "0x8a7b3f2c9e4d1a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  schemaVersion: "2.0",
  period: "2025-Q2",
  scope: {
    included: ["payroll-runs", "employee-counts", "total-disbursements"],
    excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
  },
  verificationState: "verified",
  createdAt: "2025-07-01T10:00:00Z",
  verifiedAt: "2025-07-01T10:15:00Z",
  referencedBy: "Annual Compliance Audit 2025 — Deloitte",
};

const MISMATCH_DIGEST: AttestationDigestMetadata = {
  digest: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  schemaVersion: "1.1",
  period: "2025-Q1",
  scope: {
    included: ["payroll-runs", "total-disbursements"],
    excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
  },
  verificationState: "mismatch",
  createdAt: "2025-04-01T09:00:00Z",
  verifiedAt: "2025-04-02T14:30:00Z",
  referencedBy: "Q1 Internal Review — KPMG",
};

const MISSING_DIGEST: AttestationDigestMetadata = {
  digest: "0x9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  schemaVersion: "",
  period: "2025-Q3",
  scope: {
    included: [],
    excluded: [],
  },
  verificationState: "missing",
  createdAt: "2025-09-01T00:00:00Z",
};

const INCOMPLETE_DIGEST: AttestationDigestMetadata = {
  digest: "0x4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
  schemaVersion: "3.0",
  period: "",
  scope: {
    included: ["payroll-runs"],
    excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
  },
  verificationState: "incomplete",
  createdAt: "2025-08-15T08:00:00Z",
  referencedBy: "Ad-hoc Review — PwC",
};

const ALL_DIGESTS = [VERIFIED_DIGEST, MISMATCH_DIGEST, INCOMPLETE_DIGEST, MISSING_DIGEST];

describe("AttestationDigestViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders attestation digest list heading", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    expect(screen.getByText("Attestation Digests")).toBeInTheDocument();
    expect(
      screen.getByText(/Review audit attestation digests/i),
    ).toBeInTheDocument();
  });

  it("displays all digests in the list", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    expect(screen.getByRole("list", { name: /attestation digest list/i })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
  });

  it("shows verified status badge for verified digest", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const badges = screen.getAllByText("Verified");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows mismatch status badge for mismatch digest", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const badges = screen.getAllByText("Mismatch");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows missing status badge for missing digest", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const badges = screen.getAllByText("Missing");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows incomplete status badge for incomplete digest", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const badges = screen.getAllByText("Incomplete");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows warning count for digests with validation warnings", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    expect(screen.getByText(/1 warning/)).toBeInTheDocument();
  });

  it("expands digest details when clicked", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("Digest Reference")).toBeInTheDocument();
    expect(screen.getByText("Schema Version")).toBeInTheDocument();
    expect(screen.getByText("Period")).toBeInTheDocument();
    expect(screen.getAllByText("2025-Q2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Scope")).toBeInTheDocument();
  });

  it("copies digest reference to clipboard", async () => {
    const mockWriteText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[0]);

    const copyButton = screen.getByRole("button", {
      name: /copy digest reference/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(VERIFIED_DIGEST.digest);
    });

    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("shows mismatch warning errors in expanded details", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[1]);

    expect(
      screen.getByText(/Verification state mismatch detected/i),
    ).toBeInTheDocument();
  });

  it("shows missing state errors for missing digest", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[3]);

    expect(
      screen.getByText(/Verification state is missing/i),
    ).toBeInTheDocument();
  });

  it("shows incomplete state warning for incomplete digest", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[2]);

    expect(
      screen.getByText(/Verification state is incomplete/i),
    ).toBeInTheDocument();
  });

  it("collapses digest details when clicked again", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("Digest Reference")).toBeInTheDocument();

    fireEvent.click(buttons[0]);

    expect(screen.queryByText("Digest Reference")).not.toBeInTheDocument();
  });

  it("displays scope table with included and excluded items", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[0]);

    expect(screen.getByText("payroll-runs")).toBeInTheDocument();
    expect(screen.getByText("employee-counts")).toBeInTheDocument();
    expect(screen.getByText("total-disbursements")).toBeInTheDocument();
    expect(screen.getByText("individual-salaries")).toBeInTheDocument();
    expect(screen.getByText("employee-names")).toBeInTheDocument();
    expect(screen.getByText("wallet-addresses")).toBeInTheDocument();

    const includedBadges = screen.getAllByText("Included");
    expect(includedBadges.length).toBeGreaterThanOrEqual(3);
    const excludedBadges = screen.getAllByText("Excluded");
    expect(excludedBadges.length).toBeGreaterThanOrEqual(3);
  });

  it("shows privacy notice in expanded details", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[0]);

    expect(
      screen.getByText(/Raw payroll rows are never displayed/i),
    ).toBeInTheDocument();
  });

  it("shows empty state when no digests are provided", () => {
    render(<AttestationDigestViewer digests={[]} />);

    expect(
      screen.getByText("No attestation digests available."),
    ).toBeInTheDocument();
  });

  it("shows loading state with skeleton placeholders", () => {
    render(<AttestationDigestViewer digests={[]} isLoading={true} />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows compare panel when compare button is clicked", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const compareButton = screen.getByRole("button", {
      name: /compare two digests/i,
    });
    fireEvent.click(compareButton);

    expect(screen.getByText("Compare Digests")).toBeInTheDocument();
    expect(screen.getByLabelText("Digest A")).toBeInTheDocument();
    expect(screen.getByLabelText("Digest B")).toBeInTheDocument();
  });

  it("shows differences in compare panel when selecting different digests", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const compareButton = screen.getByRole("button", {
      name: /compare two digests/i,
    });
    fireEvent.click(compareButton);

    expect(screen.getByText("Differences")).toBeInTheDocument();
    expect(screen.getByText(/Schema version/)).toBeInTheDocument();
  });

  it("hides compare panel when close button is clicked", () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const compareButton = screen.getByRole("button", {
      name: /compare two digests/i,
    });
    fireEvent.click(compareButton);

    expect(screen.getByText("Compare Digests")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", {
      name: /close comparison/i,
    });
    fireEvent.click(closeButton);

    expect(screen.queryByText("Compare Digests")).not.toBeInTheDocument();
  });

  it("shows unknown schema version warning for unrecognized versions", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[2]);

    expect(
      screen.getByText(/Schema version "3.0" is not a recognized version/),
    ).toBeInTheDocument();
  });

  it("shows missing period warning", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    const buttons = screen.getAllByRole("button", { name: /view details for digest/i });
    fireEvent.click(buttons[2]);

    expect(
      screen.getByText(/Audit period is not specified/),
    ).toBeInTheDocument();
  });

  it("displays referencedBy when present", async () => {
    render(<AttestationDigestViewer digests={ALL_DIGESTS} />);

    expect(screen.getByText(/Ref: Annual Compliance Audit 2025/)).toBeInTheDocument();
  });
});

describe("validateDigestMetadata", () => {
  it("returns valid result for complete verified digest", () => {
    const result = validateDigestMetadata(VERIFIED_DIGEST);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors for mismatch state", () => {
    const result = validateDigestMetadata(MISMATCH_DIGEST);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Verification state mismatch"),
      ]),
    );
  });

  it("returns errors for missing state", () => {
    const result = validateDigestMetadata(MISSING_DIGEST);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Verification state is missing"),
      ]),
    );
  });

  it("returns warnings for incomplete state", () => {
    const result = validateDigestMetadata(INCOMPLETE_DIGEST);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Verification state is incomplete"),
      ]),
    );
  });

  it("returns errors for null input", () => {
    const result = validateDigestMetadata(null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("No digest data provided")]),
    );
  });

  it("returns errors for missing digest value", () => {
    const result = validateDigestMetadata({
      ...VERIFIED_DIGEST,
      digest: "",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Digest reference is empty")]),
    );
  });

  it("returns warnings for empty period", () => {
    const result = validateDigestMetadata({
      ...VERIFIED_DIGEST,
      period: "",
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Audit period is not specified")]),
    );
  });

  it("returns warnings for empty scope", () => {
    const result = validateDigestMetadata({
      ...VERIFIED_DIGEST,
      scope: { included: [], excluded: [] },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("No scope items")]),
    );
  });

  it("returns warnings for unrecognized schema version", () => {
    const result = validateDigestMetadata({
      ...VERIFIED_DIGEST,
      schemaVersion: "3.0",
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("not a recognized version")]),
    );
  });
});

describe("API endpoint returns digests", () => {
  it("GET /api/attestation returns 200 with digest array", async () => {
    const { GET } = await import("@/app/api/attestation/route");
    const request = new Request("http://localhost:3000/api/attestation");
    const response = await GET(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].digest).toBeDefined();
    expect(body.data[0].schemaVersion).toBeDefined();
    expect(body.data[0].verificationState).toBeDefined();
  });
});

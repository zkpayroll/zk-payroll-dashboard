import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttestationDigestViewer } from "@/components/features/audit/AttestationDigestViewer";
import { evaluateAttestationDigest, digestsMatch } from "@/stores/auditDigest";
import type { AttestationDigest } from "@/types/audit";

const DIGEST = "a".repeat(64);

function makeDigest(overrides: Partial<AttestationDigest> = {}): AttestationDigest {
  return {
    id: "att_1",
    digest: DIGEST,
    algorithm: "sha256",
    schemaVersion: "1.1",
    period: { start: "2026-10-01T00:00:00Z", end: "2026-10-31T00:00:00Z" },
    scope: { companyId: "company_acme", payrollRunIds: ["run_1", "run_2"], employeeCount: 12 },
    expectedDigest: DIGEST,
    verificationStatus: "verified",
    verifiedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("AttestationDigestViewer (#320)", () => {
  it("shows digest, schema version, period, scope and verified state", () => {
    render(<AttestationDigestViewer digest={makeDigest()} />);

    expect(screen.getByTestId("digest-verification-state")).toHaveAttribute("data-state", "verified");
    expect(screen.getByTestId("digest-value")).toHaveTextContent(DIGEST);
    expect(screen.getByTestId("digest-schema-version")).toHaveTextContent("1.1 (sha256)");
    expect(screen.getByTestId("digest-period")).toHaveTextContent("2026-10-01 – 2026-10-31");
    expect(screen.getByTestId("digest-scope")).toHaveTextContent("company_acme · 2 payroll runs · 12 employees");
    expect(screen.queryByTestId("digest-warnings")).not.toBeInTheDocument();
  });

  it("flags a mismatch against the recorded digest", () => {
    render(<AttestationDigestViewer digest={makeDigest({ expectedDigest: "b".repeat(64) })} />);

    expect(screen.getByTestId("digest-verification-state")).toHaveAttribute("data-state", "mismatch");
    expect(screen.getByTestId("digest-warnings")).toHaveTextContent(
      "Digest does not match the value recorded at attestation."
    );
  });

  it("flags missing metadata as incomplete", () => {
    render(
      <AttestationDigestViewer
        digest={makeDigest({ digest: null, schemaVersion: null, period: null })}
      />
    );

    expect(screen.getByTestId("digest-verification-state")).toHaveAttribute("data-state", "incomplete");
    const warnings = screen.getByTestId("digest-warnings");
    expect(warnings).toHaveTextContent("Digest value is missing.");
    expect(warnings).toHaveTextContent("Schema version is missing.");
    expect(warnings).toHaveTextContent("Attestation period is missing.");
    expect(screen.getByTestId("copy-digest-btn")).toBeDisabled();
  });

  it("flags an unsupported schema version as incompatible", () => {
    render(<AttestationDigestViewer digest={makeDigest({ schemaVersion: "9.0" })} />);

    expect(screen.getByTestId("digest-verification-state")).toHaveAttribute("data-state", "incompatible");
    expect(screen.getByTestId("digest-warnings")).toHaveTextContent("Schema version 9.0 is not supported");
  });

  it("copies the digest and shows the copied state", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<AttestationDigestViewer digest={makeDigest({ digest: `0x${DIGEST.toUpperCase()}` })} onCopy={onCopy} />);

    await user.click(screen.getByTestId("copy-digest-btn"));

    expect(onCopy).toHaveBeenCalledWith(DIGEST);
    await expect(navigator.clipboard.readText()).resolves.toBe(DIGEST);
    expect(screen.getByTestId("copy-digest-btn")).toHaveTextContent("Copied");
  });

  it("compares a pasted digest reference", async () => {
    const user = userEvent.setup();
    render(<AttestationDigestViewer digest={makeDigest()} />);

    await user.type(screen.getByTestId("digest-compare-input"), `0x${DIGEST.toUpperCase()}`);
    expect(screen.getByTestId("digest-compare-result")).toHaveAttribute("data-result", "match");

    await user.clear(screen.getByTestId("digest-compare-input"));
    await user.type(screen.getByTestId("digest-compare-input"), "c".repeat(64));
    expect(screen.getByTestId("digest-compare-result")).toHaveAttribute("data-result", "mismatch");
  });

  it("does not render salary data even if a record carries it", () => {
    const withRows = {
      ...makeDigest(),
      rows: [{ employee: "Jane Doe", salary: 98765 }],
    } as AttestationDigest;
    render(<AttestationDigestViewer digest={withRows} />);

    const viewer = screen.getByTestId("attestation-digest-viewer");
    expect(viewer).not.toHaveTextContent("98765");
    expect(viewer).not.toHaveTextContent("Jane Doe");
  });
});

describe("evaluateAttestationDigest", () => {
  it("treats an unverified, consistent digest as pending", () => {
    expect(evaluateAttestationDigest(makeDigest({ verificationStatus: "pending" })).state).toBe("pending");
  });

  it("rejects a malformed digest as incompatible", () => {
    expect(
      evaluateAttestationDigest(makeDigest({ digest: "xyz", expectedDigest: null })).state
    ).toBe("incompatible");
  });

  it("matches digests regardless of case, whitespace and 0x prefix", () => {
    expect(digestsMatch(DIGEST, ` 0x${DIGEST.toUpperCase()} `)).toBe(true);
    expect(digestsMatch("", "")).toBe(false);
  });
});

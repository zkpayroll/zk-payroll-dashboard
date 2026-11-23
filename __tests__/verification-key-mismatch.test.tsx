import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  describeVerificationKeyMismatch,
  fingerprintKeyId,
  isVerificationKeyMismatch,
  VERIFICATION_KEY_MISMATCH_CODE,
  type VerificationKeyMismatch,
} from "@/lib/zk/verificationKeyMismatch";
import { VerificationKeyMismatchDetails } from "@/components/features/proofs/VerificationKeyMismatchDetails";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

const MISMATCH: VerificationKeyMismatch = {
  code: VERIFICATION_KEY_MISMATCH_CODE,
  expectedKeyId: "payroll-circuit-v2-0123456789abcdef",
  reportedKeyId: "payroll-circuit-v1-fedcba9876543210",
  circuitVersion: "v1.4.0",
  detectedAt: "2026-10-21T10:00:00Z",
};

describe("fingerprintKeyId (#763)", () => {
  it("shortens long ids and keeps short ones whole", () => {
    expect(fingerprintKeyId("payroll-circuit-v2-0123456789abcdef")).toBe("payrol…cdef");
    expect(fingerprintKeyId("vk_main_1")).toBe("vk_main_1");
  });

  it.each([undefined, null, 42, "", "abc", "has spaces in it", "x".repeat(200), "<script>alert(1)</script>", '{"pi_a":["1"]}'])(
    "refuses to show unsafe or non-identifier value %p",
    (value) => {
      expect(fingerprintKeyId(value)).toBeNull();
    }
  );
});

describe("describeVerificationKeyMismatch (#763)", () => {
  it("builds a view with fingerprints, circuit version and next steps", () => {
    const view = describeVerificationKeyMismatch(MISMATCH);
    expect(view).toMatchObject({
      expected: "payrol…cdef",
      reported: "payrol…3210",
      circuitVersion: "v1.4.0",
      fingerprintsLookEqual: false,
    });
    expect(view.nextSteps.length).toBeGreaterThanOrEqual(3);
  });

  it("reports missing or unsafe fields as unavailable and drops a bad timestamp", () => {
    const view = describeVerificationKeyMismatch({
      code: VERIFICATION_KEY_MISMATCH_CODE,
      expectedKeyId: "has spaces",
      detectedAt: "not a date",
    });
    expect(view).toMatchObject({ expected: null, reported: null, circuitVersion: null, detectedAt: null });
  });

  it("notes when shortened fingerprints look identical but ids differ", () => {
    const view = describeVerificationKeyMismatch({
      ...MISMATCH,
      expectedKeyId: "payroll-AAAA-middle-1-abcd",
      reportedKeyId: "payroll-BBBB-middle-2-abcd",
    });
    expect(view.fingerprintsLookEqual).toBe(true);
  });

  it("recognizes only the mismatch code", () => {
    expect(isVerificationKeyMismatch(MISMATCH)).toBe(true);
    expect(isVerificationKeyMismatch({ code: "OTHER" })).toBe(false);
    expect(isVerificationKeyMismatch(null)).toBe(false);
  });
});

describe("VerificationKeyMismatchDetails (#763)", () => {
  it("shows fingerprints, circuit and next steps in an alert", () => {
    render(<VerificationKeyMismatchDetails mismatch={MISMATCH} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("vk-expected")).toHaveTextContent("payrol…cdef");
    expect(screen.getByTestId("vk-reported")).toHaveTextContent("payrol…3210");
    expect(screen.getByTestId("vk-circuit")).toHaveTextContent("v1.4.0");
    expect(screen.getByText(/Do not retry the same proof/)).toBeInTheDocument();
  });

  it("never renders full key ids or proof-shaped content", () => {
    render(
      <VerificationKeyMismatchDetails
        mismatch={{ ...MISMATCH, reportedKeyId: '{"pi_a":["123","456"],"publicSignals":["999"]}' }}
      />
    );
    const text = screen.getByTestId("verification-key-mismatch").textContent ?? "";
    expect(text).not.toContain("0123456789abcdef");
    expect(text).not.toContain("pi_a");
    expect(text).not.toContain("999");
    expect(screen.getByTestId("vk-reported")).toHaveTextContent("Unavailable");
  });

  it("appears on the run detail when the run carries a mismatch, and not otherwise", () => {
    const run = { ...MOCK_PAYROLL_RUNS[0], verificationKeyMismatch: MISMATCH };
    const { unmount } = render(<PayrollRunDetail run={run} proofReference={null} />);
    expect(screen.getByTestId("verification-key-mismatch")).toBeInTheDocument();
    unmount();
    render(<PayrollRunDetail run={{ ...MOCK_PAYROLL_RUNS[0] }} proofReference={null} />);
    expect(screen.queryByTestId("verification-key-mismatch")).toBeNull();
  });
});

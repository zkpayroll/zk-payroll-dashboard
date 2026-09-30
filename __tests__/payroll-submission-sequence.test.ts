import { describe, expect, it } from "vitest";
import { getSubmissionSequenceWarning } from "@/src/payroll/submissionSequence";

describe("payroll submission sequence guard", () => {
  it("allows normal submitting and completed states", () => {
    expect(getSubmissionSequenceWarning({ currentStep: "submit", proofStatus: "success", submissionStatus: "submitting" })).toBeNull();
    expect(getSubmissionSequenceWarning({ currentStep: "submit", proofStatus: "success", submissionStatus: "success", transactionHash: "tx-reference" })).toBeNull();
  });

  it("returns an actionable privacy-safe warning for an incomplete sequence", () => {
    const warning = getSubmissionSequenceWarning({ currentStep: "submit", proofStatus: "idle", submissionStatus: "idle" });
    expect(warning).toMatch(/out of sequence/i);
    expect(warning).toMatch(/generate and verify a proof/i);
    expect(warning).not.toMatch(/\$|emp_|G[A-Z0-9]{10,}/i);
  });

  it("does not warn on earlier wizard steps", () => {
    expect(getSubmissionSequenceWarning({ currentStep: "confirm", proofStatus: "idle", submissionStatus: "idle" })).toBeNull();
  });
});

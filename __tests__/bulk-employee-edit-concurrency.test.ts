import { describe, it, expect } from "vitest";
import {
  openBulkEditSession,
  checkBulkEditConcurrency,
  assertBulkEditAllowed,
  isSessionExpired,
  BulkEditConcurrencyError,
  DEFAULT_MAX_RECORDS_PER_BATCH,
  type BulkEditSubmission,
} from "@/src/payroll/bulkEmployeeEditConcurrency";

function makeSubmission(
  overrides: Partial<BulkEditSubmission> = {},
  versionToken = "ber_1000_abcdefgh",
): BulkEditSubmission {
  return {
    versionToken,
    currentVersionToken: versionToken,
    recordCount: 10,
    ...overrides,
  };
}

describe("openBulkEditSession", () => {
  it("generates a unique version token each call", () => {
    const s1 = openBulkEditSession(5);
    const s2 = openBulkEditSession(5);
    expect(s1.versionToken).not.toBe(s2.versionToken);
  });

  it("records the supplied record count", () => {
    const session = openBulkEditSession(42);
    expect(session.recordCount).toBe(42);
  });
});

describe("isSessionExpired", () => {
  it("returns false for a freshly opened session", () => {
    const session = openBulkEditSession(1);
    expect(isSessionExpired(session, Date.now())).toBe(false);
  });

  it("returns true when more than 30 minutes have elapsed", () => {
    const session = openBulkEditSession(1);
    const thirtyOneMinutesLater = Date.now() + 31 * 60 * 1000;
    expect(isSessionExpired(session, thirtyOneMinutesLater)).toBe(true);
  });
});

describe("checkBulkEditConcurrency", () => {
  it("allows a valid submission with matching version tokens", () => {
    const session = openBulkEditSession(10);
    const submission = makeSubmission({}, session.versionToken);
    const decision = checkBulkEditConcurrency(submission, session);
    expect(decision.allowed).toBe(true);
    expect(decision.rejectionReason).toBeUndefined();
  });

  it("rejects when version tokens differ (conflict)", () => {
    const session = openBulkEditSession(10);
    const submission = makeSubmission(
      { currentVersionToken: "ber_9999_different" },
      session.versionToken,
    );
    const decision = checkBulkEditConcurrency(submission, session);
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("version_conflict");
  });

  it("rejects an empty batch", () => {
    const session = openBulkEditSession(0);
    const submission = makeSubmission({ recordCount: 0 }, session.versionToken);
    const decision = checkBulkEditConcurrency(submission, session);
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("empty_batch");
  });

  it("rejects when record count exceeds default maximum", () => {
    const session = openBulkEditSession(DEFAULT_MAX_RECORDS_PER_BATCH + 1);
    const submission = makeSubmission(
      { recordCount: DEFAULT_MAX_RECORDS_PER_BATCH + 1 },
      session.versionToken,
    );
    const decision = checkBulkEditConcurrency(submission, session);
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("batch_too_large");
  });

  it("rejects an expired session", () => {
    const session = openBulkEditSession(5);
    const submission = makeSubmission({}, session.versionToken);
    const future = Date.now() + 31 * 60 * 1000;
    const decision = checkBulkEditConcurrency(submission, session, future);
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("session_expired");
  });
});

describe("assertBulkEditAllowed", () => {
  it("throws BulkEditConcurrencyError when not allowed", () => {
    const session = openBulkEditSession(10);
    const submission = makeSubmission(
      { currentVersionToken: "ber_stale_token" },
      session.versionToken,
    );
    expect(() => assertBulkEditAllowed(submission, session)).toThrowError(
      BulkEditConcurrencyError,
    );
  });

  it("does not throw when allowed", () => {
    const session = openBulkEditSession(10);
    const submission = makeSubmission({}, session.versionToken);
    expect(() => assertBulkEditAllowed(submission, session)).not.toThrow();
  });
});

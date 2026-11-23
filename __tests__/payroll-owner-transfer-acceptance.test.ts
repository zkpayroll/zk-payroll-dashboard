import { describe, it, expect } from "vitest";
import {
  reviewOwnerTransferAcceptance,
  buildOwnerTransferDecisionAuditEntry,
  effectiveTransferStatus,
  isAcceptanceWindowOpen,
  transferStatusLabel,
  OWNER_TRANSFER_ACCEPTANCE_WINDOW_MS,
  type OwnerTransferRequest,
} from "@/src/payroll/ownerTransferAcceptance";

const NOW = Date.parse("2026-09-28T12:00:00.000Z");
const FROM = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const TO = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function request(over: Partial<OwnerTransferRequest> = {}): OwnerTransferRequest {
  return {
    id: "xfer_001",
    fromOwner: `${FROM.slice(0, 6)}...${FROM.slice(-4)}`,
    toOwner: `${TO.slice(0, 6)}...${TO.slice(-4)}`,
    toOwnerAddress: TO,
    status: "pending_acceptance",
    requestedAt: new Date(NOW - 60_000).toISOString(),
    inFlightRunCount: 0,
    ...over,
  };
}

describe("owner transfer acceptance — the missing accepting half (#511)", () => {
  it("lets the nominated wallet accept a pending request", () => {
    const review = reviewOwnerTransferAcceptance(request(), TO, "accept", NOW);
    expect(review.canDecide).toBe(true);
    expect(review.wouldTakeEffect).toBe(true);
    expect(review.effectiveStatus).toBe("pending_acceptance");
    expect(review.errors).toEqual([]);
  });

  it("does not let the nominated wallet accept via decline", () => {
    const review = reviewOwnerTransferAcceptance(request(), TO, "decline", NOW);
    expect(review.canDecide).toBe(true);
    // Declining is permitted but must not be described as taking effect.
    expect(review.wouldTakeEffect).toBe(false);
  });

  it("refuses a wallet that was not nominated", () => {
    const review = reviewOwnerTransferAcceptance(request(), FROM, "accept", NOW);
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].code).toBe("not_recipient");
    // Must not confirm the nominated address to someone probing for it.
    expect(review.errors[0].message).not.toContain(TO);
  });

  it("refuses when no wallet is connected", () => {
    const review = reviewOwnerTransferAcceptance(request(), null, "accept", NOW);
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].code).toBe("not_recipient");
  });

  it("refuses a request that was already accepted", () => {
    const review = reviewOwnerTransferAcceptance(
      request({ status: "accepted", decidedAt: new Date(NOW - 3_600_000).toISOString() }),
      TO,
      "accept",
      NOW,
    );
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].code).toBe("already_decided");
    expect(review.errors[0].message).toMatch(/already accepted/i);
  });

  it("refuses a request that was already declined and says what to do", () => {
    const review = reviewOwnerTransferAcceptance(
      request({ status: "declined" }),
      TO,
      "accept",
      NOW,
    );
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].message).toMatch(/nominate a recipient again/i);
  });

  it("expires a request once the acceptance window closes", () => {
    const stale = request({
      requestedAt: new Date(NOW - OWNER_TRANSFER_ACCEPTANCE_WINDOW_MS - 1000).toISOString(),
    });
    expect(isAcceptanceWindowOpen(stale, NOW)).toBe(false);
    expect(effectiveTransferStatus(stale, NOW)).toBe("expired");

    const review = reviewOwnerTransferAcceptance(stale, TO, "accept", NOW);
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].code).toBe("request_expired");
  });

  it("keeps the window open right up to the boundary", () => {
    const edge = request({
      requestedAt: new Date(NOW - OWNER_TRANSFER_ACCEPTANCE_WINDOW_MS + 5_000).toISOString(),
    });
    expect(isAcceptanceWindowOpen(edge, NOW)).toBe(true);
  });

  it("refuses a self-transfer, which has nothing to hand over", () => {
    const review = reviewOwnerTransferAcceptance(
      request({ fromOwner: `${TO.slice(0, 6)}...${TO.slice(-4)}` }),
      TO,
      "accept",
      NOW,
    );
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors.map((e) => e.code)).toContain("self_transfer");
  });

  it("handles a request that no longer exists", () => {
    const review = reviewOwnerTransferAcceptance(null, TO, "accept", NOW);
    expect(review.canDecide).toBe(false);
    if (review.canDecide) return;
    expect(review.errors[0].code).toBe("unknown_request");
  });

  it("warns about in-flight runs without revealing amounts", () => {
    const review = reviewOwnerTransferAcceptance(request({ inFlightRunCount: 3 }), TO, "accept", NOW);
    expect(review.notices.join(" ")).toMatch(/3 payroll runs are still in flight/);
    expect(review.notices.join(" ")).not.toMatch(/\$/);
  });

  it("always states that acceptance is irreversible", () => {
    for (const count of [0, 1, 5]) {
      const review = reviewOwnerTransferAcceptance(
        request({ inFlightRunCount: count }),
        TO,
        "accept",
        NOW,
      );
      expect(review.notices.join(" ")).toMatch(/cannot be undone/i);
    }
  });

  it("treats an unparseable request timestamp as not open", () => {
    expect(isAcceptanceWindowOpen(request({ requestedAt: "not-a-date" }), NOW)).toBe(false);
  });
});

describe("buildOwnerTransferDecisionAuditEntry", () => {
  it("records an acceptance with a masked recipient", () => {
    const entry = buildOwnerTransferDecisionAuditEntry(request(), TO, "accept", NOW);
    expect(entry.action).toBe("payroll_owner_transfer_accepted");
    expect(entry.requestId).toBe("xfer_001");
    expect(entry.decidedAt).toBe(new Date(NOW).toISOString());
    expect(entry.toOwner).toBe(`${TO.slice(0, 6)}…${TO.slice(-4)}`);
    expect(entry.toOwner).not.toBe(TO);
  });

  it("records a decline", () => {
    const entry = buildOwnerTransferDecisionAuditEntry(request(), TO, "decline", NOW);
    expect(entry.action).toBe("payroll_owner_transfer_declined");
  });

  it("throws rather than minting an audit entry for an illegal decision", () => {
    // A decision that was refused must not leave a trace suggesting it
    // happened — the audit log is what an incident review reads.
    expect(() =>
      buildOwnerTransferDecisionAuditEntry(request(), FROM, "accept", NOW),
    ).toThrow(/Cannot accept transfer request/);

    expect(() =>
      buildOwnerTransferDecisionAuditEntry(
        request({ status: "accepted" }),
        TO,
        "accept",
        NOW,
      ),
    ).toThrow(/already_decided/);
  });
});

describe("transferStatusLabel", () => {
  it("labels every status", () => {
    expect(transferStatusLabel("pending_acceptance")).toBe("Awaiting your acceptance");
    expect(transferStatusLabel("accepted")).toBe("Accepted");
    expect(transferStatusLabel("declined")).toBe("Declined");
    expect(transferStatusLabel("expired")).toBe("Expired");
  });
});

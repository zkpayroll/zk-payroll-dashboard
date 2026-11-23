import { describe, expect, it } from "vitest";
import {
  buildOwnerTransferAuditEntry,
  isValidStellarAccount,
  maskWalletAddress,
  OWNER_TRANSFER_CONFIRMATION_PHRASE,
  reviewOwnerTransfer,
  type OwnerTransferInput,
  type OwnerTransferParty,
} from "@/src/payroll/ownerTransfer";

// Valid Stellar accounts (derived from fixed seeds) so the tests are deterministic.
const OWNER_ADDRESS = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR";
const CANDIDATE_ADDRESS = "GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U";

const currentOwner: OwnerTransferParty = {
  id: "role_admin_001",
  name: "Primary Admin",
  walletAddress: OWNER_ADDRESS,
  role: "admin",
};

const operator: OwnerTransferParty = {
  id: "role_operator_001",
  name: "Payroll Operator",
  walletAddress: CANDIDATE_ADDRESS,
  role: "operator",
};

function input(overrides: Partial<OwnerTransferInput> = {}): OwnerTransferInput {
  return {
    currentOwner,
    candidate: operator,
    inFlightRunCount: 0,
    confirmationText: OWNER_TRANSFER_CONFIRMATION_PHRASE,
    acknowledged: true,
    ...overrides,
  };
}

const codes = (review: ReturnType<typeof reviewOwnerTransfer>) => review.errors.map((e) => e.code);

describe("reviewOwnerTransfer (#546)", () => {
  it("allows a valid, confirmed transfer to a directory member", () => {
    const review = reviewOwnerTransfer(input());
    expect(review).toEqual({ canSubmit: true, errors: [], warnings: [] });
  });

  it("requires a candidate", () => {
    expect(codes(reviewOwnerTransfer(input({ candidate: null })))).toContain("no_candidate");
    expect(
      codes(reviewOwnerTransfer(input({ candidate: { ...operator, walletAddress: "  " } }))),
    ).toContain("no_candidate");
  });

  it("rejects an invalid Stellar address, including a bad checksum", () => {
    expect(codes(reviewOwnerTransfer(input({ candidate: { ...operator, walletAddress: "not-an-address" } })))).toContain(
      "invalid_address",
    );
    // Right shape (G + 55 base32 chars) but the checksum is wrong.
    const badChecksum = CANDIDATE_ADDRESS.slice(0, -1) + (CANDIDATE_ADDRESS.endsWith("A") ? "B" : "A");
    expect(codes(reviewOwnerTransfer(input({ candidate: { ...operator, walletAddress: badChecksum } })))).toContain(
      "invalid_address",
    );
  });

  it("rejects transferring to the current owner", () => {
    const review = reviewOwnerTransfer(input({ candidate: { ...operator, walletAddress: ` ${OWNER_ADDRESS} ` } }));
    expect(codes(review)).toEqual(["same_as_current_owner"]);
  });

  it("blocks while payroll runs are in flight, with singular/plural wording", () => {
    const one = reviewOwnerTransfer(input({ inFlightRunCount: 1 }));
    expect(codes(one)).toEqual(["runs_in_flight"]);
    expect(one.errors[0].message).toMatch(/^1 payroll run is still in progress/);

    const many = reviewOwnerTransfer(input({ inFlightRunCount: 3 }));
    expect(many.errors[0].message).toMatch(/^3 payroll runs are still in progress/);
  });

  it("requires the exact confirmation phrase and the acknowledgement", () => {
    expect(codes(reviewOwnerTransfer(input({ confirmationText: "transfer ownership" })))).toEqual([
      "confirmation_mismatch",
    ]);
    expect(codes(reviewOwnerTransfer(input({ confirmationText: `  ${OWNER_TRANSFER_CONFIRMATION_PHRASE} ` })))).toEqual(
      [],
    );
    expect(codes(reviewOwnerTransfer(input({ acknowledged: false })))).toEqual(["not_acknowledged"]);
  });

  it("reports every blocking problem at once", () => {
    const review = reviewOwnerTransfer(
      input({ candidate: null, inFlightRunCount: 2, confirmationText: "", acknowledged: false }),
    );
    expect(review.canSubmit).toBe(false);
    expect(codes(review)).toEqual(["no_candidate", "runs_in_flight", "confirmation_mismatch", "not_acknowledged"]);
  });

  it("warns (without blocking) for read-only roles and addresses outside the directory", () => {
    const auditor = reviewOwnerTransfer(input({ candidate: { ...operator, role: "auditor" } }));
    expect(auditor.canSubmit).toBe(true);
    expect(auditor.warnings.map((w) => w.code)).toEqual(["candidate_read_only_role"]);

    const manual = reviewOwnerTransfer(
      input({ candidate: { id: null, name: "Manual address", walletAddress: CANDIDATE_ADDRESS } }),
    );
    expect(manual.canSubmit).toBe(true);
    expect(manual.warnings.map((w) => w.code)).toEqual(["candidate_outside_directory"]);
  });

  it("never exposes full wallet addresses or payroll amounts in messages", () => {
    const review = reviewOwnerTransfer(
      input({ candidate: { ...operator, walletAddress: OWNER_ADDRESS }, inFlightRunCount: 2, acknowledged: false }),
    );
    const text = [...review.errors, ...review.warnings].map((i) => i.message).join(" ");
    expect(text).not.toContain(OWNER_ADDRESS);
    expect(text).not.toMatch(/\$|USDC|XLM|salary/i);
  });
});

describe("owner transfer helpers", () => {
  it("validates Stellar account addresses", () => {
    expect(isValidStellarAccount(OWNER_ADDRESS)).toBe(true);
    expect(isValidStellarAccount("GBOPS7643QOPERATOR234567890123456789012345678901234567")).toBe(false);
    expect(isValidStellarAccount("")).toBe(false);
  });

  it("masks wallet addresses", () => {
    expect(maskWalletAddress(OWNER_ADDRESS)).toBe(`${OWNER_ADDRESS.slice(0, 6)}…${OWNER_ADDRESS.slice(-4)}`);
    expect(maskWalletAddress("GSHORT")).toBe("GSHORT");
  });

  it("builds an audit entry with masked addresses only", () => {
    const entry = buildOwnerTransferAuditEntry(currentOwner, operator, new Date("2026-09-28T10:00:00Z"));
    expect(entry).toEqual({
      action: "payroll_owner_transfer_requested",
      fromOwner: maskWalletAddress(OWNER_ADDRESS),
      toOwner: maskWalletAddress(CANDIDATE_ADDRESS),
      requestedAt: "2026-09-28T10:00:00.000Z",
    });
    expect(JSON.stringify(entry)).not.toContain(OWNER_ADDRESS);
    expect(JSON.stringify(entry)).not.toContain(CANDIDATE_ADDRESS);
  });
});

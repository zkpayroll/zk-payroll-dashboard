import { describe, it, expect } from "vitest";
import {
  describeStellarAddressIssue,
  STELLAR_ADDRESS_FORMAT_HINT,
  STELLAR_ADDRESS_LENGTH,
} from "@/lib/employees/identifierFormat";

const VALID = "G" + "A".repeat(STELLAR_ADDRESS_LENGTH - 1);

describe("employee identifier format helper (#541)", () => {
  it("describes the Stellar public key format", () => {
    expect(STELLAR_ADDRESS_FORMAT_HINT).toMatch(/56 characters/);
    expect(STELLAR_ADDRESS_FORMAT_HINT).toMatch(/starts with G/);
  });

  it("accepts a well-formed public key (ignoring surrounding spaces)", () => {
    expect(describeStellarAddressIssue(VALID)).toBeNull();
    expect(describeStellarAddressIssue(`  ${VALID}  `)).toBeNull();
  });

  it("gives an actionable message for each kind of mistake", () => {
    expect(describeStellarAddressIssue("")).toMatch(/Enter the employee/);
    expect(describeStellarAddressIssue("S" + "A".repeat(55))).toMatch(/secret key/);
    expect(describeStellarAddressIssue(VALID.slice(0, 50))).toMatch(/6 missing/);
    expect(describeStellarAddressIssue(VALID + "AA")).toMatch(/2 too many/);
    expect(describeStellarAddressIssue("X" + "A".repeat(55))).toMatch(/begin with G/);
    expect(describeStellarAddressIssue("G" + "a".repeat(55))).toMatch(/uppercase/);
    expect(describeStellarAddressIssue("G" + "A".repeat(54) + "0")).toMatch(/A–Z and digits 2–7/);
  });

  it("never echoes the entered identifier in the message", () => {
    const bad = "G" + "Q".repeat(40) + "0189";
    const msg = describeStellarAddressIssue(bad) ?? "";
    expect(msg).not.toContain(bad);
    expect(msg).not.toContain("QQQQ");
  });
});

import { describe, it, expect } from "vitest";
import type { UserRole } from "@/types";
import {
  buildRunNoteAuditEntry,
  containsSensitiveRunNoteContent,
  scanRunNoteForSensitiveContent,
  REDACTED_RUN_NOTE_PLACEHOLDER,
} from "@/lib/privacy/runNotes";
import {
  canAttachRunNote,
  describeRunNoteState,
  getRunNoteLockReason,
  getRunNoteRestrictionReason,
  RUN_NOTE_MAX_LENGTH,
  validateRunNote,
} from "@/src/payroll/runNotes";

const employees = [
  {
    id: "emp_001",
    name: "Amara Diallo",
    email: "amara.diallo@zkpayroll.io",
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  },
  {
    id: "emp_002",
    name: "Kofi Boateng",
    email: "kofi.boateng@zkpayroll.io",
    address: "GBOPS7643QOPERATOR234567890123456789012345678901234567",
  },
];

const categories = (text: string, ctx = { employees }) =>
  scanRunNoteForSensitiveContent(text, ctx).map((finding) => finding.category);

describe("scanRunNoteForSensitiveContent — compensation", () => {
  it("accepts ordinary operational handoff text", () => {
    expect(categories("Reconciled against the treasury snapshot before release.")).toEqual([]);
    expect(categories("Q1 bonus run — second attempt after a reference collision.")).toEqual([]);
  });

  it("accepts dates and batch references that only look like amounts", () => {
    expect(categories("Closing period 2026-09-25, ledger batch 20260925.")).toEqual([]);
    expect(categories("Approved during the 2026 review window.")).toEqual([]);
  });

  it("flags a currency amount", () => {
    expect(categories("Alice is owed $5,250 for this period.")).toEqual(["compensation"]);
    expect(categories("Paid out 1200 USDC to the batch.")).toEqual(["compensation"]);
  });

  it("flags a bare large number but not a small count", () => {
    expect(categories("Batch total was 48200 this cycle.")).toEqual(["compensation"]);
    expect(categories("Three of five employees were re-run.")).toEqual([]);
  });

  it("flags a compensation keyword only when a figure accompanies it", () => {
    expect(categories("Salary review scheduled with the finance team.")).toEqual([]);
    expect(categories("Salary for the role was 90000 last cycle.")).toEqual(["compensation"]);
  });
});

describe("scanRunNoteForSensitiveContent — employee identity", () => {
  it("flags a roster name, ignoring case", () => {
    expect(categories("amara diallo was excluded from this run")).toEqual([
      "employee_identity",
    ]);
  });

  it("flags an email address even when it is not in the roster", () => {
    expect(categories("Ping contractor@vendor.example for the handoff")).toEqual([
      "employee_identity",
    ]);
  });

  it("flags a wallet address", () => {
    expect(
      categories("Payout went to GBOPS7643QOPERATOR234567890123456789012345678901234567"),
    ).toEqual(["employee_identity"]);
  });

  it("flags an employee id", () => {
    expect(categories("Skipped emp_004 in the re-run.")).toEqual(["employee_identity"]);
  });

  it("does not flag a short roster name that would match too much text", () => {
    expect(
      containsSensitiveRunNoteContent("Jo is on call this week", {
        employees: [{ name: "Jo" }],
      }),
    ).toBe(false);
  });
});

describe("scanRunNoteForSensitiveContent — credentials", () => {
  it("flags credential keywords and long hex secrets", () => {
    expect(categories("Seed phrase is stored in the vault.")).toEqual(["credential"]);
    expect(categories(`Key 0x${"a".repeat(64)} was used`)).toEqual(["credential"]);
  });

  it("returns no findings for an empty note", () => {
    expect(scanRunNoteForSensitiveContent("   ")).toEqual([]);
  });

  it("never echoes the matched value in the finding", () => {
    const [finding] = scanRunNoteForSensitiveContent("Salary was 48200 for Amara Diallo");
    expect(JSON.stringify(finding)).not.toContain("48200");
    expect(JSON.stringify(finding)).not.toContain("Amara Diallo");
    expect(finding.label).toBe("Salary or payment amount");
    expect(finding.guidance.length).toBeGreaterThan(0);
  });

  it("reports every category present in one note", () => {
    expect(categories("Amara Diallo earns $4,000 — see her wallet GBOPS7643QOPERATOR234567890123456789012345678901234567")).toEqual([
      "compensation",
      "employee_identity",
    ]);
    expect(categories("mnemonic: apple orchard brick")).toEqual(["credential"]);
  });
});

describe("buildRunNoteAuditEntry", () => {
  it("keeps note bodies out of the audit metadata", () => {
    const body = "Second attempt after a reference collision";
    const entry = buildRunNoteAuditEntry({
      runId: "run_001",
      noteId: "run_note_1",
      body,
      authorRole: "admin",
      createdAt: "2026-09-26T10:00:00Z",
    });

    expect(entry).toEqual({
      runId: "run_001",
      noteId: "run_note_1",
      authorRole: "admin",
      characterCount: body.length,
      createdAt: "2026-09-26T10:00:00Z",
    });
    expect(JSON.stringify(entry)).not.toContain("Second attempt");
  });

  it("exposes a redaction placeholder for rejected note content", () => {
    expect(REDACTED_RUN_NOTE_PLACEHOLDER).toContain("SENSITIVE CONTENT");
  });
});

describe("canAttachRunNote", () => {
  it("allows admins only", () => {
    expect(canAttachRunNote("admin")).toBe(true);
    expect(canAttachRunNote("operator")).toBe(false);
    expect(canAttachRunNote("auditor")).toBe(false);
  });

  it("explains the restriction for non-admin roles", () => {
    expect(getRunNoteRestrictionReason("admin")).toBeNull();
    expect(getRunNoteRestrictionReason("operator")).toMatch(/admin-only/i);
    expect(getRunNoteRestrictionReason("auditor")).toMatch(/read-only/i);
  });
});

describe("getRunNoteLockReason", () => {
  it("allows notes on runs that are still in flight", () => {
    expect(getRunNoteLockReason({ status: "pending" })).toBeNull();
    expect(getRunNoteLockReason({ status: "verified" })).toBeNull();
  });

  it("locks cancelled and failed runs with an actionable reason", () => {
    expect(getRunNoteLockReason({ status: "cancelled" })).toMatch(/cancelled/i);
    expect(getRunNoteLockReason({ status: "failed" })).toMatch(/replacement batch/i);
  });

  it("treats a missing run record as writable", () => {
    expect(getRunNoteLockReason(null)).toBeNull();
  });
});

describe("validateRunNote", () => {
  it("accepts an empty note without an error", () => {
    const result = validateRunNote("   ");
    expect(result.isValid).toBe(true);
    expect(result.state).toBe("empty");
    expect(result.message).toBeNull();
  });

  it("accepts a clean operational note and reports the budget left", () => {
    const note = "Reconciled against the treasury snapshot.";
    const result = validateRunNote(note);
    expect(result.isValid).toBe(true);
    expect(result.state).toBe("valid");
    expect(result.characterCount).toBe(note.length);
    expect(result.remainingCharacters).toBe(RUN_NOTE_MAX_LENGTH - note.length);
  });

  it("blocks sensitive content and names the category without echoing it", () => {
    const result = validateRunNote("Amara Diallo is owed $4,000 for this period.", {
      employees,
    });

    expect(result.isValid).toBe(false);
    expect(result.state).toBe("blocked");
    expect(result.findings.map((f) => f.category)).toEqual([
      "compensation",
      "employee_identity",
    ]);
    expect(result.message).toMatch(/was not saved/i);
    expect(result.message).not.toContain("4,000");
    expect(result.message).not.toContain("Amara Diallo");
  });

  it("reports the length problem before the privacy problem", () => {
    const result = validateRunNote(`${"$4,000 ".repeat(60)}`);
    expect(result.state).toBe("too_long");
    expect(result.findings).toEqual([]);
    expect(result.message).toMatch(/character limit/i);
    expect(result.remainingCharacters).toBeLessThan(0);
  });

  it("counts characters after trimming", () => {
    const result = validateRunNote("   Re-run approved.   ");
    expect(result.characterCount).toBe("Re-run approved.".length);
  });

  it("describes each state with privacy-safe copy", () => {
    expect(describeRunNoteState(validateRunNote(""))).toBe("No note entered.");
    expect(describeRunNoteState(validateRunNote("Reconciled."))).toBe("Note is clear to save.");
    expect(describeRunNoteState(validateRunNote("$5,000 paid"))).toMatch(/privacy guardrails/i);
    expect(describeRunNoteState(validateRunNote("x".repeat(RUN_NOTE_MAX_LENGTH + 1)))).toMatch(
      /over the character limit/i,
    );
  });
});

describe("role coverage", () => {
  it("keeps every non-admin role out of the write path", () => {
    const nonAdmins: UserRole[] = ["operator", "auditor"];
    for (const role of nonAdmins) {
      expect(validateRunNote("Reconciled.").isValid).toBe(true);
      expect(canAttachRunNote(role)).toBe(false);
    }
  });
});

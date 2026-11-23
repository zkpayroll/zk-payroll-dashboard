/**
 * Issue #282 – payroll run notes: privacy leak checks (written, not run)
 *
 * Covers the store and validator paths not exercised in the existing suites:
 *   1. Success – a clean note at exactly the length limit is accepted
 *   2. Rejection – a note with a salary figure never reaches lastError,
 *      the store state, or the audit trail
 *   3. Edge – an over-length note reports the length problem, not the privacy one
 */

import { beforeEach, describe, expect, it } from "vitest";
import { usePayrollRunNotesStore } from "@/stores/payrollRunNotes";
import { RUN_NOTE_MAX_LENGTH, validateRunNote } from "@/src/payroll/runNotes";

const RUN_ID = "run_privacy_282";
const SALARY_NOTE = "Adjusted pay for the second cycle: 48200 USD confirmed.";

function resetStore() {
  usePayrollRunNotesStore.setState({ notesByRun: {}, auditEntries: [], lastError: null });
}

describe("payroll run notes – privacy leak checks", () => {
  beforeEach(resetStore);

  it("accepts a clean note at exactly the length limit", () => {
    const body = "a".repeat(RUN_NOTE_MAX_LENGTH);
    const validation = validateRunNote(body);

    expect(validation.isValid).toBe(true);
    expect(validation.remainingCharacters).toBe(0);

    const result = usePayrollRunNotesStore
      .getState()
      .addNote({ runId: RUN_ID, body, role: "admin", runStatus: "pending" });
    expect(result.success).toBe(true);
    expect(usePayrollRunNotesStore.getState().lastError).toBeNull();
  });

  it("keeps a rejected salary note out of store state, errors and audit entries", () => {
    const result = usePayrollRunNotesStore
      .getState()
      .addNote({ runId: RUN_ID, body: SALARY_NOTE, role: "admin", runStatus: "pending" });

    expect(result.success).toBe(false);
    expect(result.findings?.map((f) => f.category)).toEqual(["compensation"]);

    const state = usePayrollRunNotesStore.getState();
    expect(state.getNotes(RUN_ID)).toHaveLength(0);
    expect(state.auditEntries).toHaveLength(0);

    const serialized = JSON.stringify({
      error: result.error,
      findings: result.findings,
      lastError: state.lastError,
      notes: state.notesByRun,
      audit: state.auditEntries,
    });
    expect(serialized).not.toContain("48200");
    expect(serialized).not.toContain("Adjusted pay");
  });

  it("reports the length problem before the privacy problem for an over-length note", () => {
    const body = `${"x".repeat(RUN_NOTE_MAX_LENGTH)} 48200`;
    const validation = validateRunNote(body);

    expect(validation.state).toBe("too_long");
    expect(validation.findings).toEqual([]);
    expect(validation.message).toMatch(/character limit/i);
    expect(validation.message).not.toContain("48200");
  });
});

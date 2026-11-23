/**
 * Operational payroll-run notes (#530)
 *
 * Tests cover:
 *   1. Store – admin can attach a clean note; the write path re-validates
 *   2. Store – non-admin, locked-run, empty and sensitive notes are rejected
 *   3. Store – audit metadata excludes note bodies
 *   4. Panel  – admin happy path: add, confirm, list, remove
 *   5. Panel  – failure path: sensitive note is blocked inline with guidance
 *   6. Panel  – edge cases: read-only role, locked run, over-length note
 *   7. Privacy – no salary, roster or wallet value reaches the rendered panel
 */

import React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PayrollRun } from "@/types/models";
import { PayrollRunNotesPanel } from "@/components/features/payroll/PayrollRunNotesPanel";
import { usePayrollRunNotesStore, type AddRunNoteResult } from "@/stores/payrollRunNotes";
import { RUN_NOTE_MAX_LENGTH } from "@/src/payroll/runNotes";

// ── Helpers ──────────────────────────────────────────────────────────────────

const run = (overrides: Partial<PayrollRun> = {}): PayrollRun =>
  ({
    id: "run_notes_001",
    status: "pending",
    ...overrides,
  }) as PayrollRun;

const roster = [
  {
    id: "emp_001",
    name: "Amara Diallo",
    email: "amara.diallo@zkpayroll.io",
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  },
];

const CLEAN_NOTE = "Reconciled against the treasury snapshot before release.";

function resetStore() {
  usePayrollRunNotesStore.setState({ notesByRun: {}, auditEntries: [], lastError: null });
}

// ── Store ────────────────────────────────────────────────────────────────────

describe("usePayrollRunNotesStore", () => {
  beforeEach(resetStore);

  it("attaches a clean note for an admin and records it against the run", () => {
    const result = usePayrollRunNotesStore
      .getState()
      .addNote({ runId: "run_notes_001", body: CLEAN_NOTE, role: "admin", runStatus: "pending" });

    expect(result.success).toBe(true);
    const notes = usePayrollRunNotesStore.getState().getNotes("run_notes_001");
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe(CLEAN_NOTE);
    expect(notes[0].authorRole).toBe("admin");
    expect(usePayrollRunNotesStore.getState().lastError).toBeNull();
  });

  it("rejects an operator and an auditor with an actionable reason", () => {
    for (const role of ["operator", "auditor"] as const) {
      const result = usePayrollRunNotesStore
        .getState()
        .addNote({ runId: "run_notes_001", body: CLEAN_NOTE, role });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/admin-only/i);
    }

    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
    expect(usePayrollRunNotesStore.getState().lastError).toMatch(/admin-only/i);
  });

  it("rejects a note on a cancelled run", () => {
    const result = usePayrollRunNotesStore.getState().addNote({
      runId: "run_notes_001",
      body: CLEAN_NOTE,
      role: "admin",
      runStatus: "cancelled",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cancelled/i);
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
  });

  it("rejects a whitespace-only note", () => {
    const result = usePayrollRunNotesStore
      .getState()
      .addNote({ runId: "run_notes_001", body: "   \n  ", role: "admin" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/enter a note/i);
  });

  it("rejects a note carrying sensitive content and returns the findings", () => {
    const result = usePayrollRunNotesStore.getState().addNote({
      runId: "run_notes_001",
      body: "Amara Diallo is owed $4,000 for this period.",
      role: "admin",
      employees: roster,
    });

    expect(result.success).toBe(false);
    expect(result.findings?.map((f) => f.category)).toEqual([
      "compensation",
      "employee_identity",
    ]);
    expect(result.error).not.toContain("4,000");
    expect(result.error).not.toContain("Amara Diallo");
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
  });

  it("keeps note bodies out of the audit metadata", () => {
    usePayrollRunNotesStore
      .getState()
      .addNote({ runId: "run_notes_001", body: CLEAN_NOTE, role: "admin" });

    const [entry] = usePayrollRunNotesStore.getState().auditEntries;
    expect(entry).toMatchObject({ runId: "run_notes_001", authorRole: "admin" });
    expect(entry.characterCount).toBe(CLEAN_NOTE.length);
    expect(JSON.stringify(entry)).not.toContain("Reconciled");
  });

  it("removes a note for an admin and refuses a non-admin removal", () => {
    usePayrollRunNotesStore
      .getState()
      .addNote({ runId: "run_notes_001", body: CLEAN_NOTE, role: "admin" });
    const [note] = usePayrollRunNotesStore.getState().getNotes("run_notes_001");

    const denied = usePayrollRunNotesStore
      .getState()
      .removeNote("run_notes_001", note.id, "operator");
    expect(denied.success).toBe(false);
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toHaveLength(1);

    const removed = usePayrollRunNotesStore
      .getState()
      .removeNote("run_notes_001", note.id, "admin");
    expect(removed.success).toBe(true);
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
  });

  it("reports a missing note instead of silently succeeding", () => {
    const result = usePayrollRunNotesStore
      .getState()
      .removeNote("run_notes_001", "run_note_missing", "admin");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer exists/i);
  });
});

// ── Panel ────────────────────────────────────────────────────────────────────

describe("PayrollRunNotesPanel", () => {
  beforeEach(resetStore);

  it("shows the empty state and the privacy hint to an admin", () => {
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    expect(screen.getByTestId("payroll-run-notes-panel")).toBeInTheDocument();
    expect(screen.getByTestId("run-note-empty")).toHaveTextContent(
      "No operational notes on this payroll run yet.",
    );
    expect(screen.getByTestId("run-note-open-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("run-note-restriction")).not.toBeInTheDocument();
  });

  it("adds, confirms and lists a clean note", async () => {
    const user = userEvent.setup();
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.type(screen.getByTestId("run-note-input"), CLEAN_NOTE);
    expect(screen.getByTestId("run-note-counter")).toHaveTextContent(
      `${CLEAN_NOTE.length} / ${RUN_NOTE_MAX_LENGTH}`,
    );

    await user.click(screen.getByTestId("run-note-submit"));

    expect(screen.getByTestId("run-note-saved")).toHaveTextContent(
      "Operational note saved to this payroll run.",
    );
    expect(screen.getByTestId("run-note-list")).toHaveTextContent(CLEAN_NOTE);
    expect(screen.queryByTestId("run-note-empty")).not.toBeInTheDocument();

    const notes = usePayrollRunNotesStore.getState().getNotes("run_notes_001");
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe(CLEAN_NOTE);
  });

  it("blocks a note containing a salary figure and explains how to rewrite it", async () => {
    const user = userEvent.setup();
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.type(screen.getByTestId("run-note-input"), "Amara Diallo is owed $4,000.");

    const error = screen.getByTestId("run-note-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent("This note was not saved");
    expect(screen.getByTestId("run-note-finding-compensation")).toHaveTextContent(
      "Remove the figure.",
    );
    expect(screen.getByTestId("run-note-finding-employee_identity")).toBeInTheDocument();
    expect(screen.getByTestId("run-note-submit")).toBeDisabled();

    // The rejected text is never echoed back into the message.
    expect(error.textContent).not.toContain("4,000");
    expect(error.textContent).not.toContain("Amara Diallo");

    // A store-level write attempt is refused too, so the guard cannot be bypassed.
    let bypass: AddRunNoteResult | undefined;
    await act(async () => {
      bypass = usePayrollRunNotesStore.getState().addNote({
        runId: "run_notes_001",
        body: "Amara Diallo is owed $4,000.",
        role: "admin",
        employees: roster,
      });
    });
    expect(bypass?.success).toBe(false);
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
  });

  it("rejects a note over the character limit with the overflow", async () => {
    const user = userEvent.setup();
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.click(screen.getByTestId("run-note-input"));
    await user.paste("Reviewed with finance. ".repeat(20));

    expect(screen.getByTestId("run-note-error")).toHaveTextContent(
      "characters over the 280-character limit",
    );
    expect(screen.getByTestId("run-note-submit")).toBeDisabled();
  });

  it("keeps the editor read-only for a non-admin role and hides the save control", () => {
    render(<PayrollRunNotesPanel run={run()} userRole="auditor" employees={roster} />);

    expect(screen.getByTestId("run-note-restriction")).toHaveTextContent(/admin-only/i);
    expect(screen.queryByTestId("run-note-open-editor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("run-note-input")).not.toBeInTheDocument();
  });

  it("locks notes on a cancelled run even for an admin", () => {
    render(
      <PayrollRunNotesPanel run={run({ status: "cancelled" })} userRole="admin" employees={roster} />,
    );

    expect(screen.getByTestId("run-note-locked")).toHaveTextContent(/cancelled/i);
    expect(screen.queryByTestId("run-note-open-editor")).not.toBeInTheDocument();
  });

  it("lets an admin remove a note they previously added", async () => {
    const user = userEvent.setup();
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.type(screen.getByTestId("run-note-input"), CLEAN_NOTE);
    await user.click(screen.getByTestId("run-note-submit"));

    const [note] = usePayrollRunNotesStore.getState().getNotes("run_notes_001");
    await user.click(screen.getByTestId(`run-note-remove-${note.id}`));

    expect(screen.queryByTestId(`run-note-item-${note.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId("run-note-empty")).toBeInTheDocument();
  });

  it("scopes notes to their own payroll run", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />,
    );

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.type(screen.getByTestId("run-note-input"), CLEAN_NOTE);
    await user.click(screen.getByTestId("run-note-submit"));

    rerender(<PayrollRunNotesPanel run={run({ id: "run_notes_002" })} userRole="admin" employees={roster} />);

    expect(screen.queryByText(CLEAN_NOTE)).not.toBeInTheDocument();
    expect(screen.getByTestId("run-note-empty")).toBeInTheDocument();
  });

  it("never renders a salary figure, roster value or wallet address in the panel", async () => {
    const user = userEvent.setup();
    render(<PayrollRunNotesPanel run={run()} userRole="admin" employees={roster} />);

    await user.click(screen.getByTestId("run-note-open-editor"));
    await user.type(screen.getByTestId("run-note-input"), "Amara Diallo earns $4,000 — GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37");

    // The typed value lives only in the textarea the admin is editing; no other
    // rendered surface repeats it, and the store never accepted it.
    const panel = screen.getByTestId("payroll-run-notes-panel");
    const echoes = Array.from(panel.querySelectorAll("p, li, span, h2"))
      .map((node) => node.textContent ?? "")
      .join(" ");
    expect(echoes).not.toContain("$4,000");
    expect(echoes).not.toContain("Amara Diallo");
    expect(echoes).not.toContain("GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37");
    expect(usePayrollRunNotesStore.getState().getNotes("run_notes_001")).toEqual([]);
  });
});

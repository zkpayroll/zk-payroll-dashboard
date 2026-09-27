import { create } from "zustand";
import type { UserRole } from "@/types";
import {
  buildRunNoteAuditEntry,
  type RunNoteAuditEntry,
  type RunNoteSensitiveFinding,
} from "@/lib/privacy/runNotes";
import {
  canAttachRunNote,
  getRunNoteLockReason,
  getRunNoteRestrictionReason,
  validateRunNote,
  type RunNoteValidationOptions,
} from "@/src/payroll/runNotes";

/**
 * In-memory store for operational payroll-run notes.
 *
 * Notes are validated through the same pure rules the UI uses, so the write
 * path cannot be bypassed by calling the store directly: a non-admin, a locked
 * run, or a note that trips the privacy scanner is rejected and the reason is
 * surfaced on `lastError` for the panel to render.
 *
 * PRIVACY:
 * - Notes live in memory for the session only. Nothing is persisted to
 *   `localStorage` and no note is sent to a payroll API, log, or telemetry
 *   event, so note text cannot outlive the tab.
 * - `auditEntries` is metadata only (run id, note id, role, character count,
 *   timestamp). It is the shape an audit trail or export should use; note
 *   bodies are never included.
 */

export interface PayrollRunNote {
  id: string;
  runId: string;
  body: string;
  authorRole: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AddRunNoteInput {
  runId: string;
  body: string;
  role: UserRole;
  /** Optional run status; a final run rejects new notes. */
  runStatus?: "pending" | "verified" | "failed" | "cancelled";
  employees?: RunNoteValidationOptions["employees"];
}

export interface AddRunNoteResult {
  success: boolean;
  error?: string;
  /** Present when the write was rejected by the privacy scanner. */
  findings?: RunNoteSensitiveFinding[];
}

export interface RemoveRunNoteResult {
  success: boolean;
  error?: string;
}

interface PayrollRunNotesState {
  notesByRun: Record<string, PayrollRunNote[]>;
  auditEntries: RunNoteAuditEntry[];
  lastError: string | null;

  addNote: (input: AddRunNoteInput) => AddRunNoteResult;
  removeNote: (runId: string, noteId: string, role: UserRole) => RemoveRunNoteResult;
  getNotes: (runId: string) => PayrollRunNote[];
  clearError: () => void;
}

let noteCounter = 0;

function nextNoteId(): string {
  noteCounter += 1;
  return `run_note_${Date.now()}_${noteCounter}`;
}

export const usePayrollRunNotesStore = create<PayrollRunNotesState>()((set, get) => ({
  notesByRun: {},
  auditEntries: [],
  lastError: null,

  addNote({ runId, body, role, runStatus, employees }) {
    const fail = (error: string, findings?: RunNoteSensitiveFinding[]): AddRunNoteResult => {
      set({ lastError: error });
      return findings ? { success: false, error, findings } : { success: false, error };
    };

    if (!canAttachRunNote(role)) {
      return fail(getRunNoteRestrictionReason(role) ?? "Payroll run notes are admin-only.");
    }

    if (!runId) {
      return fail("A payroll run must be selected before a note can be attached.");
    }

    const lockReason = getRunNoteLockReason(runStatus ? { status: runStatus } : null);
    if (lockReason) {
      return fail(lockReason);
    }

    const validation = validateRunNote(body, { employees });
    if (!validation.isValid) {
      return fail(validation.message ?? "This note cannot be saved.", validation.findings);
    }

    if (validation.state === "empty") {
      return fail("Enter a note before saving. Whitespace on its own is not a note.");
    }

    const now = new Date().toISOString();
    const note: PayrollRunNote = {
      id: nextNoteId(),
      runId,
      body: body.trim(),
      authorRole: role,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      notesByRun: {
        ...state.notesByRun,
        [runId]: [...(state.notesByRun[runId] ?? []), note],
      },
      auditEntries: [
        buildRunNoteAuditEntry({
          runId,
          noteId: note.id,
          body: note.body,
          authorRole: note.authorRole,
          createdAt: note.createdAt,
        }),
        ...state.auditEntries,
      ],
      lastError: null,
    }));

    return { success: true };
  },

  removeNote(runId, noteId, role) {
    const fail = (error: string): RemoveRunNoteResult => {
      set({ lastError: error });
      return { success: false, error };
    };

    if (!canAttachRunNote(role)) {
      return fail(getRunNoteRestrictionReason(role) ?? "Payroll run notes are admin-only.");
    }

    const notes = get().getNotes(runId);
    if (!notes.some((note) => note.id === noteId)) {
      return fail("That note no longer exists on this payroll run. Refresh and try again.");
    }

    set((state) => ({
      notesByRun: {
        ...state.notesByRun,
        [runId]: (state.notesByRun[runId] ?? []).filter((note) => note.id !== noteId),
      },
      auditEntries: state.auditEntries.filter((entry) => entry.noteId !== noteId),
      lastError: null,
    }));

    return { success: true };
  },

  getNotes(runId) {
    return get().notesByRun[runId] ?? [];
  },

  clearError() {
    set({ lastError: null });
  },
}));

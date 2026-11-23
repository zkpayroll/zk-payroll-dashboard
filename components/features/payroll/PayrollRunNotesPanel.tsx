"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Lock, MessageSquarePlus, ShieldAlert, Trash2 } from "lucide-react";
import type { PayrollRun } from "@/types/models";
import type { UserRole } from "@/types";
import {
  canAttachRunNote,
  getRunNoteLockReason,
  getRunNoteRestrictionReason,
  RUN_NOTE_HINT,
  RUN_NOTE_MAX_LENGTH,
  validateRunNote,
} from "@/src/payroll/runNotes";
import { usePayrollRunNotesStore } from "@/stores/payrollRunNotes";
import type { RunNoteEmployeeContext } from "@/lib/privacy/runNotes";

export interface PayrollRunNotesPanelProps {
  run: Pick<PayrollRun, "id" | "status">;
  userRole?: UserRole;
  /** Roster entries the note must not name, so a name in a note is caught. */
  employees?: RunNoteEmployeeContext[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  auditor: "Auditor",
};

const NOTE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Admin-only operational notes for a payroll run.
 *
 * The editor validates on every keystroke against the shared privacy rules, so
 * an admin sees exactly why a note is refused before attempting to save, and
 * the store re-checks the same rules on write. Non-admins and runs in a final
 * state get a read-only panel with the reason stated rather than a silently
 * disabled control.
 */
export function PayrollRunNotesPanel({
  run,
  userRole = "operator",
  employees = [],
}: PayrollRunNotesPanelProps) {
  const notes = usePayrollRunNotesStore((state) => state.notesByRun[run.id]);
  const lastError = usePayrollRunNotesStore((state) => state.lastError);
  const addNote = usePayrollRunNotesStore((state) => state.addNote);
  const removeNote = usePayrollRunNotesStore((state) => state.removeNote);
  const clearError = usePayrollRunNotesStore((state) => state.clearError);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const isAdmin = canAttachRunNote(userRole);
  const restrictionReason = getRunNoteRestrictionReason(userRole);
  const lockReason = getRunNoteLockReason(run);
  const isLocked = lockReason !== null;
  const canEdit = isAdmin && !isLocked;

  const validation = useMemo(() => validateRunNote(draft, { employees }), [draft, employees]);
  const runNotes = notes ?? [];

  const handleOpenEditor = () => {
    clearError();
    setSavedNotice(null);
    setDraft("");
    setIsEditorOpen(true);
  };

  const handleCancel = () => {
    setIsEditorOpen(false);
    setDraft("");
    clearError();
    setSavedNotice(null);
  };

  const handleSave = () => {
    const result = addNote({
      runId: run.id,
      body: draft,
      role: userRole,
      runStatus: run.status,
      employees,
    });

    if (!result.success) return;

    setDraft("");
    setIsEditorOpen(false);
    setSavedNotice("Operational note saved to this payroll run.");
  };

  const handleRemove = (noteId: string) => {
    setSavedNotice(null);
    removeNote(run.id, noteId, userRole);
  };

  return (
    <section
      aria-labelledby="payroll-run-notes-heading"
      data-testid="payroll-run-notes-panel"
      className="bg-white rounded-lg shadow-sm p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 id="payroll-run-notes-heading" className="text-sm font-semibold text-gray-900">
            Operational Notes
          </h2>
          <p id="payroll-run-note-hint" data-testid="run-note-hint" className="text-xs text-gray-500 mt-0.5">
            {RUN_NOTE_HINT}
          </p>
        </div>
        {canEdit && !isEditorOpen && (
          <button
            type="button"
            onClick={handleOpenEditor}
            data-testid="run-note-open-editor"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-indigo-300 text-indigo-700 bg-white text-sm font-medium hover:bg-indigo-50 transition-colors shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
            Add note
          </button>
        )}
      </div>

      {restrictionReason && (
        <div
          role="status"
          data-testid="run-note-restriction"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{restrictionReason}</span>
        </div>
      )}

      {isLocked && (
        <div
          role="status"
          data-testid="run-note-locked"
          className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700"
        >
          <Lock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{lockReason}</span>
        </div>
      )}

      {isEditorOpen && (
        <div data-testid="run-note-editor" className="space-y-2">
          <label htmlFor="payroll-run-note-input" className="block text-sm font-medium text-gray-700">
            Note for this payroll run
          </label>
          <textarea
            id="payroll-run-note-input"
            data-testid="run-note-input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (savedNotice) setSavedNotice(null);
            }}
            rows={3}
            maxLength={RUN_NOTE_MAX_LENGTH + 200}
            placeholder="e.g. Second attempt after the batch reference collided with an archived run."
            aria-describedby="payroll-run-note-hint"
            aria-invalid={draft.length > 0 && !validation.isValid}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 resize-none ${
              draft.length > 0 && !validation.isValid
                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
            }`}
          />
          <div className="flex items-center justify-end">
            <span
              data-testid="run-note-counter"
              className={`text-xs tabular-nums ${
                validation.remainingCharacters < 0 ? "text-red-600" : "text-gray-400"
              }`}
            >
              {validation.characterCount} / {RUN_NOTE_MAX_LENGTH}
            </span>
          </div>

          {draft.length > 0 && !validation.isValid && (
            <div
              role="alert"
              data-testid="run-note-error"
              className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <p className="flex items-start gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{validation.message}</span>
              </p>
              {validation.findings.length > 0 && (
                <ul data-testid="run-note-findings" className="list-disc pl-8 space-y-1">
                  {validation.findings.map((finding) => (
                    <li key={finding.category} data-testid={`run-note-finding-${finding.category}`}>
                      <span className="font-medium">{finding.label}:</span> {finding.guidance}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {lastError && validation.isValid && (
            <p
              role="alert"
              data-testid="run-note-store-error"
              className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{lastError}</span>
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              data-testid="run-note-cancel"
              className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!validation.isValid || validation.state === "empty"}
              data-testid="run-note-submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save note
            </button>
          </div>
        </div>
      )}

      {savedNotice && (
        <p
          role="status"
          aria-live="polite"
          data-testid="run-note-saved"
          className="flex items-start gap-1.5 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{savedNotice}</span>
        </p>
      )}

      {runNotes.length === 0 ? (
        <p
          data-testid="run-note-empty"
          className="flex items-start gap-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3"
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>No operational notes on this payroll run yet.</span>
        </p>
      ) : (
        <ul className="space-y-2 border-t border-gray-100 pt-3" data-testid="run-note-list">
          {runNotes.map((note) => (
            <li
              key={note.id}
              data-testid={`run-note-item-${note.id}`}
              className="flex items-start justify-between gap-3 rounded-md border border-gray-200 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-900 break-words">{note.body}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {NOTE_DATE_FORMATTER.format(new Date(note.createdAt))} ·{" "}
                  {ROLE_LABELS[note.authorRole]}
                </p>
              </div>
              {isAdmin && !isLocked && (
                <button
                  type="button"
                  onClick={() => handleRemove(note.id)}
                  data-testid={`run-note-remove-${note.id}`}
                  aria-label="Remove operational note"
                  className="shrink-0 rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PayrollRunNotesPanel;

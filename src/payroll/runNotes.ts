import type { PayrollRun } from "@/types/models";
import type { UserRole } from "@/types";
import {
  RUN_NOTE_PRIVACY_NOTICE,
  scanRunNoteForSensitiveContent,
  type RunNoteEmployeeContext,
  type RunNoteScanContext,
  type RunNoteSensitiveFinding,
} from "@/lib/privacy/runNotes";

/**
 * Operational notes for payroll runs.
 *
 * A note is free-form handoff text ("reconciled against the treasury snapshot",
 * "second attempt after the batch collided") so it is useful to admins, but it
 * is also the easiest place in the product to leak a salary figure or an
 * employee's personal data into long-lived storage. This module owns the rules:
 * who may write, what may be written, and which run states refuse writes.
 *
 * PRIVACY: validation results carry static guidance and finding categories
 * only. A rejected note is never echoed back into the message, so nothing from
 * the note body can reach a log, export, telemetry event, or rendered error.
 */

export const RUN_NOTE_MAX_LENGTH = 280;

export const RUN_NOTE_HINT = `Operational handoff context for this payroll run. ${RUN_NOTE_PRIVACY_NOTICE}`;

/** Explicit UI states for the note field and the note list. */
export type RunNoteState =
  | "read_only"
  | "locked"
  | "empty"
  | "editing"
  | "valid"
  | "blocked"
  | "too_long";

export interface RunNoteValidation {
  isValid: boolean;
  state: RunNoteState;
  /** Actionable, privacy-safe message. `null` while the field is valid. */
  message: string | null;
  findings: RunNoteSensitiveFinding[];
  characterCount: number;
  remainingCharacters: number;
}

export interface RunNoteValidationOptions {
  /** Roster used to catch a note that names a specific employee. */
  employees?: RunNoteEmployeeContext[];
}

/** Roles allowed to attach or remove notes on a payroll run. */
export function canAttachRunNote(role: UserRole): boolean {
  return role === "admin";
}

/** Why a role cannot write notes, or `null` when the role can. */
export function getRunNoteRestrictionReason(role: UserRole): string | null {
  if (canAttachRunNote(role)) return null;
  return "Payroll run notes are admin-only. Operator and auditor views are read-only — ask an administrator to add this note.";
}

/** Run statuses whose record is final, so notes can no longer be attached. */
const NOTE_LOCKED_STATUSES: ReadonlyArray<PayrollRun["status"]> = ["cancelled", "failed"];

export const RUN_NOTE_LOCK_COPY: Record<string, string> = {
  cancelled: "This payroll run was cancelled. Its record is final, so notes can no longer be attached.",
  failed: "This payroll run failed. Its record is final, so notes can no longer be attached. Create a replacement batch instead.",
};

/**
 * Reason the run refuses new notes, or `null` when notes are still accepted.
 * An unknown run id (`undefined`) is treated as writable so the rule can be
 * reused before a run record has loaded.
 */
export function getRunNoteLockReason(run?: Pick<PayrollRun, "status"> | null): string | null {
  if (!run) return null;
  if (!NOTE_LOCKED_STATUSES.includes(run.status)) return null;
  return RUN_NOTE_LOCK_COPY[run.status] ?? "This payroll run is final, so notes can no longer be attached.";
}

function buildScanContext(options: RunNoteValidationOptions = {}): RunNoteScanContext {
  return { employees: options.employees ?? [] };
}

/**
 * Validate note text against the length budget and the privacy scanner.
 *
 * Length is checked first so an over-long note reports the length problem
 * rather than the privacy one — otherwise the author would trim their text
 * without ever learning that a sensitive value was also present.
 */
export function validateRunNote(
  raw: string,
  options: RunNoteValidationOptions = {},
): RunNoteValidation {
  const trimmed = raw.trim();
  const characterCount = trimmed.length;
  const remainingCharacters = RUN_NOTE_MAX_LENGTH - characterCount;

  if (characterCount === 0) {
    return {
      isValid: true,
      state: "empty",
      message: null,
      findings: [],
      characterCount,
      remainingCharacters,
    };
  }

  if (characterCount > RUN_NOTE_MAX_LENGTH) {
    return {
      isValid: false,
      state: "too_long",
      message: `Note is ${characterCount - RUN_NOTE_MAX_LENGTH} characters over the ${RUN_NOTE_MAX_LENGTH}-character limit. Shorten it before saving.`,
      findings: [],
      characterCount,
      remainingCharacters,
    };
  }

  const findings = scanRunNoteForSensitiveContent(trimmed, buildScanContext(options));
  if (findings.length > 0) {
    return {
      isValid: false,
      state: "blocked",
      message:
        findings.length === 1
          ? `This note was not saved: ${findings[0].label.toLowerCase()} is not allowed in a payroll run note.`
          : `This note was not saved: ${findings.length} categories of sensitive content are not allowed in a payroll run note.`,
      findings,
      characterCount,
      remainingCharacters,
    };
  }

  return {
    isValid: true,
    state: characterCount > 0 ? "valid" : "empty",
    message: null,
    findings: [],
    characterCount,
    remainingCharacters,
  };
}

/** One-line, privacy-safe description of where the note field stands. */
export function describeRunNoteState(validation: RunNoteValidation): string {
  switch (validation.state) {
    case "empty":
      return "No note entered.";
    case "valid":
      return "Note is clear to save.";
    case "too_long":
      return "Note is over the character limit.";
    case "blocked":
      return "Note is blocked by the privacy guardrails.";
    default:
      return "Note is ready.";
  }
}

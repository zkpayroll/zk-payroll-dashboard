/**
 * Types for employee import workflow and duplicate resolution.
 *
 * Sensitive employee fields (name, email, SSN, salary, address) are
 * represented as redacted placeholders in the UI layer. Raw values
 * never leave the import store.
 */

// ─── Duplicate classification ──────────────────────────────────────────────

/**
 * How closely two employee records match.
 * - exact: All comparison fields match (same name, email, SSN hash)
 * - likely: Name/email match but SSN or other fields differ
 */
export type DuplicateConfidence = "exact" | "likely";

/**
 * Resolution action chosen by the admin for a duplicate cluster.
 */
export type DuplicateResolution =
  | "merge"
  | "keep_separate"
  | "dismiss"
  | "request_review";

// ─── Employee record (import source) ──────────────────────────────────────

/**
 * A raw employee record from an import file.
 * The UI never renders raw sensitive fields — they are always redacted.
 */
export interface EmployeeImportRecord {
  /** Unique row identifier from the import file */
  rowId: string;
  /** Employee full name (SENSITIVE — redacted in UI) */
  name: string;
  /** Employee email (SENSITIVE — redacted in UI) */
  email: string;
  /** Job title / department (non-sensitive) */
  department?: string;
  /** Employee ID in the source system */
  employeeId?: string;
  /** Salary or compensation (SENSITIVE — redacted in UI) */
  salary?: number;
  /** Hire date */
  hireDate?: string;
  /** Arbitrary extra fields from the import */
  extraFields?: Record<string, unknown>;
}

/**
 * Redacted preview of an employee record for safe UI display.
 */
export interface RedactedEmployeePreview {
  /** Stable, non-reversible hash of the employee ID */
  refHash: string;
  /** Redacted department label (safe) */
  department?: string;
  /** Redacted hire date (safe) */
  hireDate?: string;
  /** Number of fields that differ from the primary record in the cluster */
  differingFields: string[];
}

// ─── Duplicate cluster ─────────────────────────────────────────────────────

/**
 * A group of employee records flagged as duplicates.
 */
export interface DuplicateCluster {
  /** Unique cluster identifier */
  id: string;
  /** Confidence level of the duplicate match */
  confidence: DuplicateConfidence;
  /** The employee records in this cluster */
  records: EmployeeImportRecord[];
  /** Redacted previews for UI rendering */
  previews: RedactedEmployeePreview[];
  /** Fields used for matching (e.g. "name", "email", "ssn_hash") */
  matchedOn: string[];
  /** Current resolution status (null = unresolved) */
  resolution: DuplicateResolution | null;
  /** Admin notes when resolution is "request_review" */
  reviewNotes?: string;
  /** Whether this cluster blocks import completion */
  blocksImport: boolean;
}

// ─── Import session ────────────────────────────────────────────────────────

export type ImportStatus =
  | "idle"
  | "parsing"
  | "analyzing"
  | "review_duplicates"
  | "ready"
  | "importing"
  | "completed"
  | "failed";

/**
 * The full state of an employee import session.
 */
export interface ImportSession {
  /** Current status of the import workflow */
  status: ImportStatus;
  /** All records parsed from the import file */
  records: EmployeeImportRecord[];
  /** Detected duplicate clusters */
  duplicateClusters: DuplicateCluster[];
  /** Total number of unique (non-duplicate) records */
  uniqueCount: number;
  /** Number of unresolved critical clusters */
  unresolvedCriticalCount: number;
  /** Whether the import can proceed (no critical unresolved duplicates) */
  canFinalize: boolean;
  /** Error message if parsing or analysis failed */
  error?: string;
}

// ─── Store interface ───────────────────────────────────────────────────────

export interface EmployeeImportStore {
  session: ImportSession;

  /** Start a new import by providing raw records */
  startImport: (records: EmployeeImportRecord[]) => void;

  /** Mark duplicate analysis as complete with detected clusters */
  setDuplicateClusters: (clusters: DuplicateCluster[]) => void;

  /** Resolve a duplicate cluster with the chosen action */
  resolveCluster: (
    clusterId: string,
    resolution: DuplicateResolution,
    notes?: string
  ) => void;

  /** Check if the import is blocked by unresolved critical duplicates */
  isImportBlocked: () => boolean;

  /** Finalize the import (only possible when canFinalize is true) */
  finalizeImport: () => boolean;

  /** Reset the import session */
  resetImport: () => void;
}

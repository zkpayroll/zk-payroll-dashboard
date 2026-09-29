import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExportFormat = "csv" | "json" | "pdf";
export type WizardStep =
  | "select"
  | "review"
  | "configure"
  | "export"
  | "complete";

export type ExportStatus =
  | "idle"
  | "preparing"
  | "exporting"
  | "complete"
  | "failed";

export type AuditGrantStatus =
  | "active"
  | "expired"
  | "revoked"
  | "out_of_scope"
  | "missing";

export type ExportBlockReason =
  | "no_records"
  | "grant_missing"
  | "grant_expired"
  | "grant_revoked"
  | "grant_out_of_scope"
  | "sensitive_fields_unredacted"
  | "invalid_date_range"
  | null;

export interface AuditPacketEntry {
  id: string;
  type:
    | "payroll_run"
    | "transaction"
    | "compliance_event"
    | "key_access_log"
    | "treasury_movement";
  title: string;
  date: string;
  summary: string;
  selected: boolean;
  fields: string[];
  metadata?: Record<string, unknown>;
}

export interface AuditGrant {
  id: string;
  status: AuditGrantStatus;

  /**
   * Fields/categories this grant allows the auditor to access.
   *
   * An empty array means the grant does not explicitly restrict
   * individual fields at this UI layer.
   */
  allowedFields: string[];

  /**
   * Optional record types covered by the grant.
   *
   * An empty array means all record types are allowed.
   */
  allowedRecordTypes: AuditPacketEntry["type"][];

  expiresAt?: string;
  revokedAt?: string;
  issuedAt?: string;
}

export interface RedactionState {
  field: string;
  redacted: boolean;
  sensitive: boolean;
  reason?: string;
}

export interface GrantValidation {
  valid: boolean;
  status: AuditGrantStatus;
  reason: string | null;
  checkedAt: string | null;
}

export interface ExportJob {
  id: string;
  status: ExportStatus;
  format: ExportFormat;
  entries: string[];
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  downloadUrl?: string;
  fileSize?: number;
  recordCount: number;
}

interface AuditExportStore {
  entries: AuditPacketEntry[];
  currentStep: WizardStep;
  exportFormat: ExportFormat;
  includeMetadata: boolean;
  dateRangeStart: string;
  dateRangeEnd: string;

  /**
   * Search/filter state.
   */
  searchQuery: string;

  /**
   * Audit grant currently being used for this export.
   */
  auditGrant: AuditGrant | null;

  /**
   * Result of the latest grant validation.
   */
  grantValidation: GrantValidation;

  /**
   * Field-level redaction decisions.
   */
  redactions: Record<string, RedactionState>;

  activeExportJob: ExportJob | null;
  exportHistory: ExportJob[];

  setEntries: (entries: AuditPacketEntry[]) => void;

  toggleEntry: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;

  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  setExportFormat: (format: ExportFormat) => void;
  setIncludeMetadata: (include: boolean) => void;
  setDateRange: (start: string, end: string) => void;

  setSearchQuery: (query: string) => void;

  /**
   * Grant management and validation.
   */
  setAuditGrant: (grant: AuditGrant | null) => void;
  validateAuditGrant: () => GrantValidation;
  clearGrantValidation: () => void;

  /**
   * Redaction management.
   */
  initializeRedactions: () => void;
  setFieldRedaction: (
    field: string,
    redacted: boolean
  ) => void;
  toggleFieldRedaction: (field: string) => void;
  redactAllSensitiveFields: () => void;
  getRedactionState: (field: string) => RedactionState | undefined;

  /**
   * Export validation.
   */
  getExportBlockReason: () => ExportBlockReason;
  getExportBlockMessage: () => string | null;
  canExport: () => boolean;

  startExport: () => void;
  updateExportProgress: (progress: number) => void;
  completeExport: (downloadUrl: string, fileSize: number) => void;
  failExport: (error: string) => void;

  getSelectedEntries: () => AuditPacketEntry[];
  getFilteredEntries: (
    type?: AuditPacketEntry["type"]
  ) => AuditPacketEntry[];

  reset: () => void;
}

const STEPS: WizardStep[] = [
  "select",
  "review",
  "configure",
  "export",
  "complete",
];

const SENSITIVE_FIELD_PATTERNS = [
  "salary",
  "amount",
  "employee_id",
  "employee_name",
  "email",
  "phone",
  "address",
  "wallet",
  "recipient",
  "sender",
  "account",
  "bank",
  "ssn",
  "tax",
  "dob",
  "date_of_birth",
  "private_key",
  "secret",
];

const initialGrantValidation: GrantValidation = {
  valid: false,
  status: "missing",
  reason: "No audit grant has been provided.",
  checkedAt: null,
};

const initialState = {
  entries: [] as AuditPacketEntry[],
  currentStep: "select" as WizardStep,
  exportFormat: "csv" as ExportFormat,
  includeMetadata: true,
  dateRangeStart: "",
  dateRangeEnd: "",
  activeExportJob: null as ExportJob | null,
  exportHistory: [] as ExportJob[],
  searchQuery: "",

  auditGrant: null as AuditGrant | null,

  grantValidation: initialGrantValidation,

  redactions: {} as Record<string, RedactionState>,
};

function isSensitiveField(field: string): boolean {
  const normalized = field.toLowerCase();

  return SENSITIVE_FIELD_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
}

function getDefaultRedactionState(
  field: string
): RedactionState {
  const sensitive = isSensitiveField(field);

  return {
    field,
    sensitive,
    redacted: sensitive,
    reason: sensitive
      ? "Sensitive field is redacted by default."
      : undefined,
  };
}

function isGrantExpired(grant: AuditGrant): boolean {
  if (grant.status === "expired") {
    return true;
  }

  if (!grant.expiresAt) {
    return false;
  }

  return new Date(grant.expiresAt).getTime() <= Date.now();
}

function isGrantRevoked(grant: AuditGrant): boolean {
  return (
    grant.status === "revoked" ||
    Boolean(grant.revokedAt)
  );
}

function hasInvalidDateRange(
  dateRangeStart: string,
  dateRangeEnd: string
): boolean {
  if (!dateRangeStart || !dateRangeEnd) {
    return false;
  }

  return (
    new Date(dateRangeStart).getTime() >
    new Date(dateRangeEnd).getTime()
  );
}

export const useAuditExportStore =
  create<AuditExportStore>()(
    persist(
      (set, get) => ({
        ...initialState,

        setEntries: (entries) => {
          set({ entries });

          /*
           * Automatically establish safe defaults whenever a new
           * audit scope is loaded.
           */
          setTimeout(() => {
            get().initializeRedactions();
          }, 0);
        },

        toggleEntry: (id) =>
          set((state) => ({
            entries: state.entries.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    selected: !entry.selected,
                  }
                : entry
            ),
          })),

        selectAll: () =>
          set((state) => ({
            entries: state.entries.map((entry) => ({
              ...entry,
              selected: true,
            })),
          })),

        deselectAll: () =>
          set((state) => ({
            entries: state.entries.map((entry) => ({
              ...entry,
              selected: false,
            })),
          })),

        setCurrentStep: (currentStep) =>
          set({ currentStep }),

        nextStep: () =>
          set((state) => {
            /*
             * Do not allow the user to enter the export step unless
             * the audit packet is valid.
             */
            if (
              state.currentStep === "configure" &&
              !get().canExport()
            ) {
              return {};
            }

            const idx = STEPS.indexOf(
              state.currentStep
            );

            if (idx < STEPS.length - 1) {
              return {
                currentStep: STEPS[idx + 1],
              };
            }

            return {};
          }),

        prevStep: () =>
          set((state) => {
            const idx = STEPS.indexOf(
              state.currentStep
            );

            if (idx > 0) {
              return {
                currentStep: STEPS[idx - 1],
              };
            }

            return {};
          }),

        setExportFormat: (exportFormat) =>
          set({ exportFormat }),

        setIncludeMetadata: (includeMetadata) =>
          set({ includeMetadata }),

        setDateRange: (
          dateRangeStart,
          dateRangeEnd
        ) =>
          set({
            dateRangeStart,
            dateRangeEnd,
          }),

        setSearchQuery: (searchQuery) =>
          set({ searchQuery }),

        setAuditGrant: (auditGrant) => {
          set({
            auditGrant,
            grantValidation: auditGrant
              ? {
                  valid: false,
                  status: auditGrant.status,
                  reason:
                    "Audit grant has not been validated yet.",
                  checkedAt: null,
                }
              : initialGrantValidation,
          });

          /*
           * Recalculate redactions when the grant changes.
           * Sensitive fields remain redacted unless explicitly
           * permitted by the grant.
           */
          get().initializeRedactions();
        },

        validateAuditGrant: () => {
          const {
            auditGrant,
            entries,
          } = get();

          if (!auditGrant) {
            const result: GrantValidation = {
              valid: false,
              status: "missing",
              reason:
                "No active audit grant is available.",
              checkedAt:
                new Date().toISOString(),
            };

            set({
              grantValidation: result,
            });

            return result;
          }

          if (isGrantRevoked(auditGrant)) {
            const result: GrantValidation = {
              valid: false,
              status: "revoked",
              reason:
                "This audit grant has been revoked and cannot be used for export.",
              checkedAt:
                new Date().toISOString(),
            };

            set({
              grantValidation: result,
            });

            return result;
          }

          if (isGrantExpired(auditGrant)) {
            const result: GrantValidation = {
              valid: false,
              status: "expired",
              reason:
                "This audit grant has expired and cannot be used for export.",
              checkedAt:
                new Date().toISOString(),
            };

            set({
              grantValidation: result,
            });

            return result;
          }

          if (
            auditGrant.status ===
            "out_of_scope"
          ) {
            const result: GrantValidation = {
              valid: false,
              status: "out_of_scope",
              reason:
                "This audit grant does not cover the requested audit scope.",
              checkedAt:
                new Date().toISOString(),
            };

            set({
              grantValidation: result,
            });

            return result;
          }

          const selectedEntries =
            entries.filter(
              (entry) => entry.selected
            );

          /*
           * Some existing audit grants may not contain
           * allowedRecordTypes. Treat an absent value as
           * an unrestricted record-type scope.
           */
          const allowedRecordTypes =
            auditGrant.allowedRecordTypes ?? [];

          if (allowedRecordTypes.length > 0) {
            const invalidRecord =
              selectedEntries.find(
                (entry) =>
                  !allowedRecordTypes.includes(
                    entry.type
                  )
              );

            if (invalidRecord) {
              const result: GrantValidation = {
                valid: false,
                status: "out_of_scope",
                reason: `The audit grant does not authorize the "${invalidRecord.type}" record type.`,
                checkedAt:
                  new Date().toISOString(),
              };

              set({
                grantValidation: result,
              });

              return result;
            }
          }

          /*
           * Some existing audit grants may not contain
           * allowedFields. Treat an absent value as an
           * unrestricted field scope at this UI layer.
           */
          const allowedFields =
            auditGrant.allowedFields ?? [];

          if (allowedFields.length > 0) {
            const hasUnauthorizedField =
              selectedEntries.some((entry) =>
                entry.fields.some(
                  (field) =>
                    !isSensitiveField(field) &&
                    !allowedFields.includes(
                      field
                    )
                )
              );

            if (hasUnauthorizedField) {
              const result: GrantValidation = {
                valid: false,
                status: "out_of_scope",
                reason:
                  "One or more requested fields are outside the audit grant scope.",
                checkedAt:
                  new Date().toISOString(),
              };

              set({
                grantValidation: result,
              });

              return result;
            }
          }

          const result: GrantValidation = {
            valid: true,
            status: "active",
            reason: null,
            checkedAt:
              new Date().toISOString(),
          };

          set({
            grantValidation: result,
          });

          return result;
        },

        clearGrantValidation: () =>
          set({
            grantValidation: initialGrantValidation,
          }),

        initializeRedactions: () => {
          const {
            entries,
            auditGrant,
          } = get();

          const fields = Array.from(
            new Set(
              entries.flatMap(
                (entry) => entry.fields
              )
            )
          );

          const nextRedactions: Record<
            string,
            RedactionState
          > = {};

          for (const field of fields) {
            const sensitive =
              isSensitiveField(field);

            const explicitlyAllowed =
              auditGrant?.allowedFields?.includes(
                field
              ) ?? false;

            /*
             * Sensitive fields remain redacted by
             * default, even if a grant exists.
             *
             * This is deliberate: authorization to access
             * a field does not automatically mean it should
             * be disclosed.
             */
            nextRedactions[field] = {
              field,
              sensitive,
              redacted:
                sensitive &&
                !explicitlyAllowed,
              reason: sensitive
                ? "Sensitive field is redacted by default."
                : undefined,
            };
          }

          set({
            redactions: nextRedactions,
          });
        },

        setFieldRedaction: (
          field,
          redacted
        ) => {
          const existing =
            get().redactions[field] ??
            getDefaultRedactionState(field);

          set((state) => ({
            redactions: {
              ...state.redactions,
              [field]: {
                ...existing,
                redacted,
              },
            },
          }));
        },

        toggleFieldRedaction: (field) => {
          const current =
            get().redactions[field] ??
            getDefaultRedactionState(field);

          get().setFieldRedaction(
            field,
            !current.redacted
          );
        },

        redactAllSensitiveFields: () => {
          set((state) => {
            const redactions = {
              ...state.redactions,
            };

            for (const field of Object.keys(
              redactions
            )) {
              if (redactions[field].sensitive) {
                redactions[field] = {
                  ...redactions[field],
                  redacted: true,
                };
              }
            }

            return { redactions };
          });
        },

        getRedactionState: (field) =>
          get().redactions[field],

        getExportBlockReason: () => {
          const {
            entries,
            auditGrant,
            grantValidation,
            dateRangeStart,
            dateRangeEnd,
            redactions,
          } = get();

          const selectedEntries =
            entries.filter(
              (entry) => entry.selected
            );

          if (selectedEntries.length === 0) {
            return "no_records";
          }

          if (
            hasInvalidDateRange(
              dateRangeStart,
              dateRangeEnd
            )
          ) {
            return "invalid_date_range";
          }

          /*
           * Always perform grant validation immediately before
           * deciding whether an export is allowed.
           */
          if (!auditGrant) {
            return "grant_missing";
          }

          if (isGrantRevoked(auditGrant)) {
            return "grant_revoked";
          }

          if (isGrantExpired(auditGrant)) {
            return "grant_expired";
          }

          if (
            auditGrant.status ===
            "out_of_scope"
          ) {
            return "grant_out_of_scope";
          }

          if (
            !grantValidation.valid ||
            grantValidation.status !== "active"
          ) {
            switch (
              grantValidation.status
            ) {
              case "revoked":
                return "grant_revoked";

              case "expired":
                return "grant_expired";

              case "out_of_scope":
                return "grant_out_of_scope";

              case "missing":
                return "grant_missing";

              default:
                break;
            }

            return "grant_out_of_scope";
          }

          /*
           * Sensitive fields must remain redacted unless the
           * user has explicitly changed the redaction state.
           */
          const unredactedSensitiveField =
            Object.values(redactions).find(
              (redaction) =>
                redaction.sensitive &&
                !redaction.redacted
            );

          if (unredactedSensitiveField) {
            return "sensitive_fields_unredacted";
          }

          return null;
        },

        getExportBlockMessage: () => {
          const reason =
            get().getExportBlockReason();

          switch (reason) {
            case "no_records":
              return "Select at least one audit record before exporting.";

            case "grant_missing":
              return "Export is blocked because no audit grant is available.";

            case "grant_expired":
              return "Export is blocked because the audit grant has expired.";

            case "grant_revoked":
              return "Export is blocked because the audit grant has been revoked.";

            case "grant_out_of_scope":
              return "Export is blocked because the requested audit scope is outside the permissions of the current grant.";

            case "sensitive_fields_unredacted":
              return "Export is blocked because one or more sensitive fields are not redacted.";

            case "invalid_date_range":
              return "Export is blocked because the selected date range is invalid.";

            default:
              return null;
          }
        },

        canExport: () => {
          return (
            get().getExportBlockReason() ===
            null
          );
        },

        startExport: () => {
          /*
           * Hard security gate.
           *
           * Even if a UI button accidentally calls startExport(),
           * the store refuses to create an export job when the
           * packet is invalid.
           */
          if (!get().canExport()) {
            return;
          }

          const {
            entries,
            exportFormat,
          } = get();

          const selected = entries.filter(
            (entry) => entry.selected
          );

          const job: ExportJob = {
            id: `export_${Date.now()}`,
            status: "preparing",
            format: exportFormat,
            entries: selected.map(
              (entry) => entry.id
            ),
            progress: 0,
            createdAt:
              new Date().toISOString(),
            recordCount: selected.length,
          };

          set((state) => ({
            activeExportJob: job,
            exportHistory: [
              ...state.exportHistory,
              job,
            ],
          }));
        },

        updateExportProgress: (progress) =>
          set((state) => {
            if (!state.activeExportJob) {
              return {};
            }

            const updated = {
              ...state.activeExportJob,
              progress,
              status:
                "exporting" as ExportStatus,
            };

            return {
              activeExportJob: updated,
              exportHistory:
                state.exportHistory.map(
                  (job) =>
                    job.id === updated.id
                      ? updated
                      : job
                ),
            };
          }),

        completeExport: (
          downloadUrl,
          fileSize
        ) =>
          set((state) => {
            if (!state.activeExportJob) {
              return {};
            }

            const updated: ExportJob = {
              ...state.activeExportJob,
              status: "complete",
              progress: 100,
              completedAt:
                new Date().toISOString(),
              downloadUrl,
              fileSize,
            };

            return {
              activeExportJob: updated,
              currentStep: "complete",
              exportHistory:
                state.exportHistory.map(
                  (job) =>
                    job.id === updated.id
                      ? updated
                      : job
                ),
            };
          }),

        failExport: (error) =>
          set((state) => {
            if (!state.activeExportJob) {
              return {};
            }

            const updated: ExportJob = {
              ...state.activeExportJob,
              status: "failed",
              error,
            };

            return {
              activeExportJob: updated,
              exportHistory:
                state.exportHistory.map(
                  (job) =>
                    job.id === updated.id
                      ? updated
                      : job
                ),
            };
          }),

        getSelectedEntries: () =>
          get().entries.filter(
            (entry) => entry.selected
          ),

        getFilteredEntries: (type) => {
          const {
            entries,
            searchQuery,
          } = get();

          let filtered = entries;

          if (type) {
            filtered = filtered.filter(
              (entry) =>
                entry.type === type
            );
          }

          if (searchQuery.trim()) {
            const query =
              searchQuery
                .trim()
                .toLowerCase();

            filtered = filtered.filter(
              (entry) =>
                entry.title
                  .toLowerCase()
                  .includes(query) ||
                entry.summary
                  .toLowerCase()
                  .includes(query)
            );
          }

          return filtered;
        },

        reset: () =>
          set({
            ...initialState,
            grantValidation:
              initialGrantValidation,
          }),
      }),

      {
        name: "zk-payroll-audit-export",
      }
    )
  );
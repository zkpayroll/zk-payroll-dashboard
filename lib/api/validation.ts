import { z } from "zod";

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Employee Schemas ─────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  address: z
    .string()
    .length(56, "Must be a valid Stellar public key (56 chars)"),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  department: z.string().min(1).optional(),
  salary: z.number().positive(),
  salaryCommitment: z.string().min(1, "ZK salary commitment is required"),
  isActive: z.boolean().default(true),
  startDate: z.string().datetime(),
  lastPayment: z.string().datetime().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ─── Payroll Transaction Schemas ──────────────────────────────────────────────

export const createPayrollSchema = z.object({
  companyId: z.string().min(1),
  totalAmount: z.number().positive(),
  employeeCount: z.number().int().positive(),
  employeeIds: z.array(z.string()).min(1),
  proof: z.string().min(1, "ZK proof is required"),
});

export const updatePayrollStatusSchema = z.object({
  status: z.enum(["pending", "verified", "failed", "cancelled", "paused"]),
  txHash: z.string().optional(),
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollStatusInput = z.infer<
  typeof updatePayrollStatusSchema
>;

// ─── Transaction Query Schema ─────────────────────────────────────────────────

export const transactionQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "verified", "failed", "cancelled", "paused"]).optional(),
  companyId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ─── Payroll Cancellation Schema ─────────────────────────────────────────────────

export const cancelPayrollSchema = z.object({
  status: z.literal("cancelled"),
  reason: z.string().min(3, "Cancellation reason must be at least 3 characters").optional(),
  signature: z.string().min(1, "Signature is required for cancellation"),
});

export type CancelPayrollInput = z.infer<typeof cancelPayrollSchema>;

// ─── Emergency Payroll Pause Schema (#665) ───────────────────────────────────

export const pausePayrollSchema = z.object({
  reason: z.string().min(3, "Pause reason must be at least 3 characters"),
});

export type PausePayrollInput = z.infer<typeof pausePayrollSchema>;

export const resumePayrollSchema = z.object({
  notes: z.string().optional(),
});

export type ResumePayrollInput = z.infer<typeof resumePayrollSchema>;

// ─── Upload Checkpoint Schema ─────────────────────────────────────────────────

/**
 * Body sent by the dashboard when recording a payroll upload checkpoint.
 *
 * Privacy contract: salary amounts, employee IDs, wallet addresses, and ZK
 * proof data are explicitly excluded from this payload. Only structural
 * progress metadata is accepted.
 */
export const saveUploadCheckpointSchema = z.object({
  /** Opaque run identifier generated when the wizard session started. */
  runId: z.string().min(1, "runId is required"),
  /** Upload stage at which the checkpoint is being written. */
  stage: z.enum(
    ["draft_started", "proof_generated", "confirmed", "submitting", "completed"],
    { message: "stage must be a valid UploadCheckpointStage" },
  ),
  /**
   * Number of employees in the batch.
   * Must be a non-negative integer — zero is valid for an empty-batch edge case.
   * Raw salary amounts must NOT be sent.
   */
  employeeCount: z
    .number()
    .int("employeeCount must be an integer")
    .nonnegative("employeeCount cannot be negative"),
  /** Whether a valid ZK proof existed at checkpoint time. */
  proofReady: z.boolean(),
});

export type SaveUploadCheckpointInput = z.infer<typeof saveUploadCheckpointSchema>;

// ─── Validation Helper ────────────────────────────────────────────────────────

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: result.error.issues };
  }
  return { success: true, data: result.data };
}

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
  status: z.enum(["pending", "verified", "failed"]),
  txHash: z.string().optional(),
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollStatusInput = z.infer<
  typeof updatePayrollStatusSchema
>;

// ─── Transaction Query Schema ─────────────────────────────────────────────────

export const transactionQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "verified", "failed"]).optional(),
  companyId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

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

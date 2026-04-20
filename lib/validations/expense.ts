import { z } from "zod";

export const createExpenseSchema = z.object({
  grantId: z.string().min(1, "Grant is required"),
  categoryId: z.string().min(1, "Budget category is required"),
  suggestedCategory: z.string().max(200).optional(),
  vendorName: z.string().max(200).or(z.literal("")).optional(),
  vendorEmail: z.string().max(200).or(z.literal("")).optional(),
  vendorPhone: z.string().max(20).or(z.literal("")).optional(),
  vendorWebsite: z.string().max(500).or(z.literal("")).optional(),
  description: z.string().min(1, "Description is required").max(2000),
  amount: z.coerce.number().positive("Amount must be positive"),
  frequency: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"]).default("ONE_TIME"),
  expenseType: z.string().min(1, "Expense type is required").max(100),
  // DDIA Ch12 F1 — optional end-to-end idempotency key. Clients that
  // care about retry-safety send a UUID v4; a same-UUID retry returns
  // the original expense with 200 instead of creating a duplicate.
  // Omitted by older clients → create as before (no dedup).
  requestId: z.string().uuid("requestId must be a valid UUID").optional(),
});

export const approveExpenseSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(2000),
  notes: z.string().max(2000).optional(),
});

export const updateExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000).optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  categoryId: z.string().min(1).optional(),
  vendorName: z.string().max(200).or(z.literal("")).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

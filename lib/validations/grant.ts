import { z } from "zod";

export const benefitFlagsSchema = z.object({
  ssi: z.boolean().default(false),
  ssdi: z.boolean().default(false),
  mediCal: z.boolean().default(false),
  medicaid: z.boolean().default(false),
  able: z.boolean().default(false),
});

export const createGrantSchema = z.object({
  name: z.string().min(1, "Grant name is required").max(200),
  description: z.string().max(2000).optional(),
  grantIssuerName: z.string().min(1, "Grant issuer name is required").max(200),
  grantIssuerContact: z.string().max(200).optional(),
  beneficiaryId: z.string().optional(),
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  startDate: z.coerce.date({ required_error: "Start date is required" }),
  endDate: z.coerce.date().optional(),
  restrictions: z.string().max(5000).optional(),
  benefitFlags: benefitFlagsSchema.optional(),
});

export const updateGrantSchema = createGrantSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
});

export const createBudgetCategorySchema = z.object({
  grantId: z.string().min(1),
  name: z.string().min(1, "Category name is required").max(100),
  allocatedAmount: z.coerce.number().positive("Amount must be positive"),
  cardMode: z.enum(["SINGLE_CARD", "PER_VENDOR"]).default("SINGLE_CARD"),
});

export type CreateGrantInput = z.infer<typeof createGrantSchema>;
export type UpdateGrantInput = z.infer<typeof updateGrantSchema>;
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategorySchema>;

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
  purpose: z.string().max(500).optional(),
  blockedMCCs: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
});

export const updateGrantSchema = createGrantSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
});

// BSRS Ch 5 P2 — transitions to ARCHIVED/COMPLETED are terminal and
// irreversible without platform-admin intervention, so they require a
// written justification that lands in AuditLog.newValue.reason. PAUSED
// is intentionally not gated (reversible, routine operator action).
export const terminalGrantStatuses = ["ARCHIVED", "COMPLETED"] as const;

export const patchGrantBodySchema = updateGrantSchema
  .extend({ reason: z.string().optional() })
  .superRefine((val, ctx) => {
    const isTerminal =
      val.status !== undefined &&
      (terminalGrantStatuses as readonly string[]).includes(val.status);
    if (isTerminal && (!val.reason || val.reason.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message:
          "Reason (min 10 characters) is required when setting grant status to ARCHIVED or COMPLETED",
      });
    }
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

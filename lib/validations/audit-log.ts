import { z } from "zod";

// Strict date string validation - must be a valid ISO date string or YYYY-MM-DD
const dateStringSchema = z
  .string()
  .refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Invalid date format" }
  );

export const auditLogQuerySchema = z.object({
  search: z.string().max(200).optional(),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

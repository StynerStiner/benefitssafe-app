import { z } from "zod";

export const createSubscriptionSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  grantId: z.string().min(1, "Grant is required"),
  categoryId: z.string().min(1, "Budget category is required"),
  serviceName: z.string().min(1, "Service name is required").max(200),
  loginEmail: z.string().max(200).optional().default(""),
  monthlyCost: z.coerce.number().positive("Monthly cost must be a positive number"),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  renewalDate: z.coerce.date().nullable().optional(),
  billingUpdateStatus: z
    .enum(["PENDING", "CARD_ISSUED", "CARD_SHARED", "UPDATED", "VERIFIED"])
    .default("PENDING"),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

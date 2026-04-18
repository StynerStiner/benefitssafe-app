import { z } from "zod";

export const vendorTypeValues = [
  "SAAS_SUBSCRIPTION",
  "SERVICE_PROVIDER",
  "ONE_TIME_VENDOR",
] as const;

export const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required").max(200),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  type: z.enum(vendorTypeValues, { required_error: "Vendor type is required" }),
  phone: z.string().max(20).or(z.literal("")).optional(),
  website: z.string().url("Invalid URL").or(z.literal("")).optional(),
  address: z.string().max(500).or(z.literal("")).optional(),
  paymentMethod: z.enum(["ach", "card", "check"]).or(z.literal("")).optional(),
  notes: z.string().max(2000).or(z.literal("")).optional(),
  taxIdCollected: z.boolean().optional(),
  form1099Required: z.boolean().optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

// BSRS Ch 5 P2 — rejecting a vendor transitions them to BLOCKED, which is
// a high-risk moderation decision (blocks all future disbursements on that
// vendor org-wide). Reason is written verbatim to AuditLog.newValue.reason
// for the weekly audit review cadence.
export const rejectVendorSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type RejectVendorInput = z.infer<typeof rejectVendorSchema>;

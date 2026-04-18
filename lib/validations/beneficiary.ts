import { z } from "zod";

export const benefitProgramsSchema = z.object({
  ssi: z.boolean().default(false),
  ssdi: z.boolean().default(false),
  mediCal: z.boolean().default(false),
  medicaid: z.boolean().default(false),
  able: z.boolean().default(false),
  calFresh: z.boolean().default(false),
  ihss: z.boolean().default(false),
});

export const createBeneficiarySchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Valid email is required"),
  phone: z.string().max(20).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  addressStreet: z.string().max(200).optional().or(z.literal("")),
  addressCity: z.string().max(100).optional().or(z.literal("")),
  addressState: z.string().max(2).optional().or(z.literal("")),
  addressZip: z.string().max(10).optional().or(z.literal("")),
  ssnLast4: z
    .string()
    .regex(/^\d{4}$/, "Must be exactly 4 digits")
    .optional()
    .or(z.literal("")),
  benefitPrograms: benefitProgramsSchema.optional(),
  emergencyContactName: z.string().max(100).optional().or(z.literal("")),
  emergencyContactPhone: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  avatarUrl: z.string().max(2048).optional().or(z.literal("")),
});

export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;

export const DEACTIVATION_REASON_MIN = 10;
export const DEACTIVATION_REASON_MAX = 500;

// BSRS Ch 5 §5.3: irreversible state changes on human subjects require a
// justification string. Only applies to deactivation (isActive === false) —
// reactivation and profile-only edits pass through untouched.
export const updateBeneficiarySchema = createBeneficiarySchema
  .partial()
  .omit({ email: true })
  .extend({
    isActive: z.boolean().optional(),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isActive !== false) return;
    const trimmed = data.reason?.trim() ?? "";
    if (trimmed.length < DEACTIVATION_REASON_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: `Reason must be at least ${DEACTIVATION_REASON_MIN} characters when deactivating`,
      });
    }
    if (trimmed.length > DEACTIVATION_REASON_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: `Reason must be at most ${DEACTIVATION_REASON_MAX} characters`,
      });
    }
  });

export type UpdateBeneficiaryInput = z.infer<typeof updateBeneficiarySchema>;

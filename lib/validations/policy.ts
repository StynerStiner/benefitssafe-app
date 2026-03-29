import { z } from "zod";

const policySettingEnum = z.enum(["ALLOWED", "DISALLOWED", "REQUIRES_REVIEW"]);

export const updatePolicySchema = z.object({
  id: z.string().optional(),
  cashToRecipient: policySettingEnum.optional(),
  reimbursementToRecipient: policySettingEnum.optional(),
  rentUtilityPayments: policySettingEnum.optional(),
  recurringSubscriptions: policySettingEnum.optional(),
  maxSingleTransaction: z.coerce.number().positive().nullable().optional(),
  allowedCategories: z.array(z.string().max(200)).nullable().optional(),
  blockedCategories: z.array(z.string().max(200)).nullable().optional(),
});

export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

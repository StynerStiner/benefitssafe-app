import { z } from "zod";

export const createDocumentSchema = z.object({
  entityType: z
    .string()
    .min(1, "Entity type is required")
    .max(50)
    .refine(
      (val) => ["expense", "vendor", "grant", "beneficiary"].includes(val),
      { message: "Entity type must be one of: expense, vendor, grant, beneficiary" }
    ),
  entityId: z.string().min(1, "Entity ID is required"),
  fileType: z
    .string()
    .max(50)
    .refine(
      (val) => ["receipt", "invoice", "contract", "grant_letter", "benefits_letter", "id_document", "verification", "other"].includes(val),
      { message: "File type must be one of: receipt, invoice, contract, grant_letter, benefits_letter, id_document, verification, other" }
    )
    .default("other"),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

import { z } from "zod";

export const createConversationSchema = z.object({
  recipientId: z.string().min(1, "Recipient is required"),
  subject: z.string().max(200).optional(),
  message: z.string().min(1, "Message is required").max(5000),
  department: z.string().max(100).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

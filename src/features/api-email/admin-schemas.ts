import { z } from "zod";

export const applicationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome da aplicação."),
  description: z.string().trim().optional(),
  senderEmail: z.string().trim().email("Informe o remetente da aplicação."),
  isActive: z.boolean().default(true)
});

export const applicationCredentialSchema = z.object({
  password: z.string().min(1, "Informe a senha do remetente.")
});

import { z } from "zod";

export const domainRateLimitSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Informe um domínio.")
    .max(120)
    .regex(/^[a-z0-9.-]+$/, "Informe apenas o domínio, sem protocolo ou caminho."),
  messagesPerMinute: z.coerce.number().int().positive().max(10000),
  delayMs: z.coerce.number().int().nonnegative().max(3600000),
  active: z.coerce.boolean().default(true)
});

export type DomainRateLimitInput = z.infer<typeof domainRateLimitSchema>;

export const adminUserUpdateSchema = z.object({
  role: z.enum(["ADMIN", "OPERATOR", "AUDITOR"]),
  active: z.coerce.boolean()
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

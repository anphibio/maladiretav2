import { z } from "zod";
import { isInstitutionalEmail } from "@/config/env";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu usuário.")
  .max(80, "Usuário muito longo.")
  .regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado.")
  .refine((value) => !value.includes("@"), "Informe apenas o usuário, sem o domínio.");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Informe a senha do Zimbra.")
});

export type LoginInput = z.infer<typeof loginSchema>;

export function buildInstitutionalEmail(username: string): string {
  const domain = process.env.ZIMBRA_DOMAIN ?? "tceal.tc.br";
  const email = `${username.trim().toLowerCase()}@${domain.toLowerCase()}`;

  if (!isInstitutionalEmail(email)) {
    throw new Error("Domínio institucional inválido.");
  }

  return email;
}

import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().default("Sistema de Mala Direta TCE-AL"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ZIMBRA_DOMAIN: z.string().default("tceal.tc.br"),
  ZIMBRA_SMTP_HOST: z.string().min(1),
  ZIMBRA_SMTP_PORT: z.coerce.number().int().positive().default(587),
  ZIMBRA_SMTP_SECURE: z
    .string()
    .transform((value) => value === "true")
    .default("false"),
  ZIMBRA_IMAP_HOST: z.string().optional(),
  ZIMBRA_IMAP_PORT: z.coerce.number().int().positive().default(993),
  ZIMBRA_IMAP_SECURE: z
    .string()
    .transform((value) => value !== "false")
    .default("true"),
  BOUNCE_IMAP_MAILBOX: z.string().default("INBOX"),
  SESSION_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(16),
  DEFAULT_MIN_EMAIL_DELAY_MS: z.coerce.number().int().nonnegative().default(20000),
  DEFAULT_MAX_EMAIL_DELAY_MS: z.coerce.number().int().nonnegative().default(45000),
  DEFAULT_PAUSE_EVERY_EMAILS: z.coerce.number().int().positive().default(25),
  DEFAULT_PAUSE_DURATION_MS: z.coerce.number().int().nonnegative().default(300000),
  DEFAULT_HOURLY_EMAIL_LIMIT: z.coerce.number().int().positive().default(90),
  MAX_RECIPIENTS_PER_CAMPAIGN: z.coerce.number().int().positive().default(5000),
  BOOTSTRAP_ADMIN_EMAILS: z.string().optional(),
  CRON_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function isInstitutionalEmail(email: string): boolean {
  const domain = process.env.ZIMBRA_DOMAIN ?? "tceal.tc.br";
  return email.trim().toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

export function isBootstrapAdminEmail(email: string): boolean {
  const configured = process.env.BOOTSTRAP_ADMIN_EMAILS ?? "";
  const admins = configured
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(email.trim().toLowerCase());
}

import { AuditAction, type User } from "@prisma/client";
import { getEnv } from "@/config/env";
import { prisma } from "@/lib/prisma/client";
import type { SystemSettingsInput } from "@/features/settings/schemas";
import { registerAuditLog } from "@/services/audit/audit-service";

function getDefaultSettings(): SystemSettingsInput {
  const env = getEnv();

  return {
    defaultMinEmailDelayMs: env.DEFAULT_MIN_EMAIL_DELAY_MS,
    defaultMaxEmailDelayMs: env.DEFAULT_MAX_EMAIL_DELAY_MS,
    defaultPauseEveryEmails: env.DEFAULT_PAUSE_EVERY_EMAILS,
    defaultPauseDurationMs: env.DEFAULT_PAUSE_DURATION_MS,
    defaultHourlyEmailLimit: env.DEFAULT_HOURLY_EMAIL_LIMIT,
    maxRecipientsPerCampaign: env.MAX_RECIPIENTS_PER_CAMPAIGN,
    queueDispatchEnabled: process.env.QUEUE_DISPATCH_ENABLED === "true"
  };
}

const settingDescriptions: Record<keyof SystemSettingsInput, string> = {
  defaultMinEmailDelayMs: "Delay mínimo padrão entre envios.",
  defaultMaxEmailDelayMs: "Delay máximo padrão entre envios.",
  defaultPauseEveryEmails: "Quantidade de envios antes de pausar.",
  defaultPauseDurationMs: "Duração da pausa padrão.",
  defaultHourlyEmailLimit: "Limite padrão de mensagens por hora.",
  maxRecipientsPerCampaign: "Quantidade máxima de destinatários por campanha.",
  queueDispatchEnabled: "Define se a fila deve disparar e-mails automaticamente."
};

function parseSettingValue(key: keyof SystemSettingsInput, value: string): number | boolean {
  if (key === "queueDispatchEnabled") {
    return value === "true";
  }

  return Number(value);
}

export async function getSystemSettings(): Promise<SystemSettingsInput> {
  const defaultSettings = getDefaultSettings();
  const rows = await prisma.setting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return Object.fromEntries(
    Object.entries(defaultSettings).map(([key, defaultValue]) => {
      const typedKey = key as keyof SystemSettingsInput;
      const value = values.get(key);

      return [key, value === undefined ? defaultValue : parseSettingValue(typedKey, value)];
    })
  ) as SystemSettingsInput;
}

export async function updateSystemSettings(input: SystemSettingsInput, user: User) {
  await prisma.$transaction(
    Object.entries(input).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: {
          key,
          value: String(value),
          description: settingDescriptions[key as keyof SystemSettingsInput]
        },
        update: {
          value: String(value),
          description: settingDescriptions[key as keyof SystemSettingsInput]
        }
      })
    )
  );

  await registerAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "settings",
    metadata: input
  });

  return getSystemSettings();
}

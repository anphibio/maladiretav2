import { z } from "zod";

export const systemSettingsSchema = z.object({
  defaultMinEmailDelayMs: z.coerce.number().int().nonnegative().max(3600000),
  defaultMaxEmailDelayMs: z.coerce.number().int().nonnegative().max(3600000),
  defaultPauseEveryEmails: z.coerce.number().int().positive().max(1000000),
  defaultPauseDurationMs: z.coerce.number().int().nonnegative().max(86400000),
  defaultHourlyEmailLimit: z.coerce.number().int().positive().max(1000000),
  maxRecipientsPerCampaign: z.coerce.number().int().positive().max(1000000),
  queueDispatchEnabled: z.coerce.boolean()
}).refine((value) => value.defaultMaxEmailDelayMs >= value.defaultMinEmailDelayMs, {
  message: "O delay máximo precisa ser maior ou igual ao delay mínimo.",
  path: ["defaultMaxEmailDelayMs"]
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;

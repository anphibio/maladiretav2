import { z } from "zod";

const optionalScheduledDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  });

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da campanha."),
  subject: z.string().trim().min(2, "Informe o assunto da campanha."),
  htmlBody: z.string().min(1, "Informe o corpo da mensagem."),
  textBody: z.string().min(1, "Informe o corpo da mensagem."),
  bodyMode: z.enum(["html", "text"]).default("html"),
  scheduledAt: optionalScheduledDate
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  name: z.string().trim().min(2, "Informe o nome da campanha.").optional(),
  subject: z.string().trim().min(2, "Informe o assunto da campanha.").optional(),
  htmlBody: z.string().min(1, "Informe o corpo da mensagem.").optional(),
  textBody: z.string().min(1, "Informe o corpo da mensagem.").optional()
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

import { z } from "zod";

export const sendTestSchema = z.object({
  recipientEmail: z.string().email("Informe um e-mail de teste válido."),
  password: z.string().min(1, "Informe a senha do Zimbra para enviar o teste.")
});

export const queueCampaignSchema = z.object({
  password: z.string().optional()
});

export type SendTestInput = z.infer<typeof sendTestSchema>;
export type QueueCampaignInput = z.infer<typeof queueCampaignSchema>;

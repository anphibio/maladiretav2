import { z } from "zod";

const emailTaskSchema = z.object({
  toEmail: z.string().trim().email("Informe um destinatário válido."),
  subject: z.string().trim().min(2, "Informe o assunto."),
  body: z.string().min(1, "Informe o corpo da mensagem.").optional(),
  htmlBody: z.string().min(1, "Informe o corpo HTML.").optional(),
  textBody: z.string().min(1, "Informe o corpo em texto.").optional(),
  externalReferenceId: z.string().trim().max(120).optional()
}).superRefine((value, ctx) => {
  if (!value.body && !value.htmlBody && !value.textBody) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["body"],
      message: "Informe body, htmlBody ou textBody."
    });
  }
});

export const sendApiEmailSchema = z.union([emailTaskSchema, z.array(emailTaskSchema).min(1).max(500)]);

export const apiEmailQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50)
});

export type SendApiEmailItem = z.infer<typeof emailTaskSchema>;

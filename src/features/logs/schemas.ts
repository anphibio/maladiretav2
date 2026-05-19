import { z } from "zod";

export const logQuerySchema = z.object({
  type: z.enum(["audit", "access", "email"]).default("audit"),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

export type LogQuery = z.infer<typeof logQuerySchema>;

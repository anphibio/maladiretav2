import { z } from "zod";

export const reportQuerySchema = z.object({
  type: z.enum(["campaigns", "failures", "access", "audit"]),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(5000).default(1000)
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

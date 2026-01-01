import { z } from "zod";

export const EvidenceItemSchema = z.object({
  file: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  snippet: z.string().optional(),
  label: z.string(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

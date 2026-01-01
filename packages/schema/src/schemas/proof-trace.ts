import { z } from "zod";

export const ProofNodeKindSchema = z.enum([
  "route",
  "middleware",
  "handler",
  "function",
  "sink",
  "config",
  "other",
]);

export const ProofNodeSchema = z.object({
  kind: ProofNodeKindSchema,
  label: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
});

export const ProofTraceSchema = z.object({
  summary: z.string(),
  nodes: z.array(ProofNodeSchema),
});

export type ProofNodeKind = z.infer<typeof ProofNodeKindSchema>;
export type ProofNode = z.infer<typeof ProofNodeSchema>;
export type ProofTrace = z.infer<typeof ProofTraceSchema>;

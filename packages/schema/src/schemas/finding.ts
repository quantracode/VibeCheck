import { z } from "zod";
import { ClaimSchema } from "./claim.js";
import { EvidenceItemSchema } from "./evidence.js";
import { ProofTraceSchema } from "./proof-trace.js";

export const SeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const CategorySchema = z.enum([
  "auth",
  "validation",
  "middleware",
  "secrets",
  "injection",
  "privacy",
  "config",
  "network",
  "crypto",
  "uploads",
  "hallucinations",
  "other",
]);

export const RemediationSchema = z.object({
  recommendedFix: z.string(),
  patch: z.string().optional(),
});

export const ReferenceLinksSchema = z.object({
  owasp: z.string().url().optional(),
  cwe: z.string().url().optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  category: CategorySchema,
  ruleId: z.string().regex(/^VC-[A-Z]+-\d{3}$/, {
    message: "ruleId must match pattern VC-XXX-000",
  }),
  title: z.string(),
  description: z.string(),
  evidence: z.array(EvidenceItemSchema).min(1),
  claim: ClaimSchema.optional(),
  proof: ProofTraceSchema.optional(),
  remediation: RemediationSchema,
  links: ReferenceLinksSchema.optional(),
  fingerprint: z.string(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Remediation = z.infer<typeof RemediationSchema>;
export type ReferenceLinks = z.infer<typeof ReferenceLinksSchema>;
export type Finding = z.infer<typeof FindingSchema>;

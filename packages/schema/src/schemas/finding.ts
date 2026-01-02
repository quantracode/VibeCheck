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
  "abuse",
  "other",
]);

// ============================================================================
// Compute Abuse Classification
// ============================================================================

export const AbuseRiskSchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
]);

export const AbuseCategorySchema = z.enum([
  "ai_generation",      // LLM/AI model invocations
  "code_execution",     // Code evaluation/execution
  "file_processing",    // File parsing, conversion
  "external_api",       // Expensive external API calls
  "computation",        // CPU-intensive operations
  "data_export",        // Bulk data operations
  "upload_processing",  // File upload handling
]);

export const AbuseClassificationSchema = z.object({
  /** Abuse risk level */
  risk: AbuseRiskSchema,
  /** Category of compute abuse */
  category: AbuseCategorySchema,
  /** Estimated cost amplification factor (1x = baseline, 100x = 100 times more expensive) */
  costAmplification: z.number().min(1).max(10000),
  /** Missing enforcement controls */
  missingEnforcement: z.array(z.enum([
    "auth",
    "rate_limit",
    "request_size_limit",
    "timeout",
    "input_validation",
  ])),
  /** Heuristic confidence */
  confidence: z.number().min(0).max(1),
});

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
  /** Optional compute abuse classification */
  abuseClassification: AbuseClassificationSchema.optional(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Remediation = z.infer<typeof RemediationSchema>;
export type ReferenceLinks = z.infer<typeof ReferenceLinksSchema>;
export type AbuseRisk = z.infer<typeof AbuseRiskSchema>;
export type AbuseCategory = z.infer<typeof AbuseCategorySchema>;
export type AbuseClassification = z.infer<typeof AbuseClassificationSchema>;
export type Finding = z.infer<typeof FindingSchema>;

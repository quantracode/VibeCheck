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
  // Phase 4 categories
  "correlation",    // Cross-pack correlation findings
  "authorization",  // Role/ownership/privilege checks
  "lifecycle",      // Create/update/delete symmetry
  "supply-chain",   // Package.json/lockfile analysis
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

// ============================================================================
// Cross-Pack Correlation Data (Phase 4)
// ============================================================================

export const CorrelationPatternSchema = z.enum([
  // PR #1 patterns
  "auth_without_validation",     // Route has auth but no input validation
  "middleware_bypass",           // Middleware exists but route not covered
  "secret_in_unprotected",       // Secret used in unprotected endpoint
  "validation_without_auth",     // Input validated but no auth on state-changing
  "create_update_asymmetry",     // CREATE validates, UPDATE doesn't
  "ownership_without_auth",      // Ownership check but no auth check
  // PR #2 patterns
  "middleware_upload_gap",       // Upload endpoint not covered by middleware
  "network_auth_leak",           // Token forwarded to SSRF-prone fetch
  "privacy_auth_context",        // Sensitive logging in authenticated context
  "crypto_auth_gate",            // jwt.decode() on auth gate path
  "hallucination_coverage_gap",  // Comment claims protection, proof trace disagrees
]);

export const CorrelationDataSchema = z.object({
  /** IDs of related findings that form this correlation */
  relatedFindingIds: z.array(z.string()),
  /** The correlation pattern detected */
  pattern: CorrelationPatternSchema,
  /** Brief explanation of the correlation */
  explanation: z.string(),
});

export const RemediationSchema = z.object({
  recommendedFix: z.string(),
  patch: z.string().optional(),
});

// ============================================================================
// AI-Native Developer Enhancements
// ============================================================================

/** Urgency levels in plain English */
export const UrgencySchema = z.enum([
  "Fix immediately before deploying",
  "Fix before next release",
  "Should fix soon",
  "Good to fix eventually",
  "Nice to have",
]);

/** Plain English explanation of the finding */
export const PlainEnglishSchema = z.object({
  /** What's wrong in simple terms (e.g., "Anyone can delete data without logging in") */
  problem: z.string(),
  /** Why it matters - real-world impact */
  impact: z.string(),
  /** What could happen if exploited (optional worst case) */
  worstCase: z.string().optional(),
});

/** Line-by-line change explanation */
export const CodeChangeSchema = z.object({
  /** Line number in the "after" code */
  line: z.number(),
  /** Explanation of what this change does */
  explanation: z.string(),
});

/** Before/after code comparison */
export const CodeComparisonSchema = z.object({
  /** Current vulnerable code */
  before: z.string(),
  /** Secure version of the code */
  after: z.string(),
  /** Language for syntax highlighting */
  language: z.string().default("typescript"),
  /** Line-by-line explanation of changes */
  changes: z.array(CodeChangeSchema).optional(),
});

/** A single step in the fix wizard */
export const FixStepSchema = z.object({
  /** Step number */
  step: z.number(),
  /** Title of this step */
  title: z.string(),
  /** Detailed action to take */
  action: z.string(),
  /** Optional code to copy */
  code: z.string().optional(),
  /** Optional command to run */
  command: z.string().optional(),
  /** How to verify this step worked */
  verification: z.string().optional(),
});

/** AI-friendly prompt for getting help */
export const AIPromptSchema = z.object({
  /** Pre-formatted prompt for AI assistants */
  template: z.string(),
  /** Suggested follow-up questions */
  followUpQuestions: z.array(z.string()).optional(),
});

/** Contextual severity explanation */
export const SeverityContextSchema = z.object({
  /** Plain English urgency */
  urgency: UrgencySchema,
  /** Why this severity level was assigned */
  reasoning: z.string(),
});

/** Full enhancements bundle for AI-native developers */
export const FindingEnhancementsSchema = z.object({
  /** Plain English explanation */
  plainEnglish: PlainEnglishSchema.optional(),
  /** Before/after code comparison */
  codeComparison: CodeComparisonSchema.optional(),
  /** Step-by-step fix instructions */
  fixSteps: z.array(FixStepSchema).optional(),
  /** AI-friendly prompt for getting help */
  aiPrompt: AIPromptSchema.optional(),
  /** Contextual severity explanation */
  severityContext: SeverityContextSchema.optional(),
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
  /** Optional correlation data for cross-pack findings (Phase 4) */
  correlationData: CorrelationDataSchema.optional(),
  /** References to related finding IDs/fingerprints (Phase 4) */
  relatedFindings: z.array(z.string()).optional(),
  /** AI-native developer enhancements for clearer understanding */
  enhancements: FindingEnhancementsSchema.optional(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Remediation = z.infer<typeof RemediationSchema>;
export type ReferenceLinks = z.infer<typeof ReferenceLinksSchema>;
export type AbuseRisk = z.infer<typeof AbuseRiskSchema>;
export type AbuseCategory = z.infer<typeof AbuseCategorySchema>;
export type AbuseClassification = z.infer<typeof AbuseClassificationSchema>;
export type CorrelationPattern = z.infer<typeof CorrelationPatternSchema>;
export type CorrelationData = z.infer<typeof CorrelationDataSchema>;
export type Finding = z.infer<typeof FindingSchema>;

// AI-Native Developer Enhancement Types
export type Urgency = z.infer<typeof UrgencySchema>;
export type PlainEnglish = z.infer<typeof PlainEnglishSchema>;
export type CodeChange = z.infer<typeof CodeChangeSchema>;
export type CodeComparison = z.infer<typeof CodeComparisonSchema>;
export type FixStep = z.infer<typeof FixStepSchema>;
export type AIPrompt = z.infer<typeof AIPromptSchema>;
export type SeverityContext = z.infer<typeof SeverityContextSchema>;
export type FindingEnhancements = z.infer<typeof FindingEnhancementsSchema>;

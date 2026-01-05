import { z } from "zod";
import { SeveritySchema, CategorySchema, FindingSchema } from "@vibecheck/schema";
import { ProfileNameSchema, ThresholdsSchema, OverrideSchema, RegressionPolicySchema } from "./policy-config.js";
import { WaiverSchema } from "./waiver.js";

/**
 * Policy report version
 */
export const POLICY_REPORT_VERSION = "0.1" as const;

/**
 * Policy evaluation status
 */
export const PolicyStatusSchema = z.enum(["pass", "warn", "fail"]);

/**
 * Reason why policy resulted in a certain status
 */
export const PolicyReasonSchema = z.object({
  /** The status this reason contributes to */
  status: PolicyStatusSchema,
  /** Machine-readable reason code */
  code: z.enum([
    "severity_threshold",
    "confidence_threshold",
    "count_threshold",
    "new_high_critical",
    "severity_regression",
    "net_increase",
    "override_fail",
    "no_issues",
    // Semantic regression codes
    "protection_removed",
    "coverage_decreased",
    "severity_group_increase",
    "semantic_regression",
  ]),
  /** Human-readable description */
  message: z.string(),
  /** Optional finding IDs that triggered this */
  findingIds: z.array(z.string()).optional(),
  /** Optional details */
  details: z.record(z.unknown()).optional(),
});

/**
 * Summary counts
 */
export const PolicySummaryCountsSchema = z.object({
  /** Total findings after filtering */
  total: z.number().int(),
  /** By severity */
  bySeverity: z.object({
    critical: z.number().int(),
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
    info: z.number().int(),
  }),
  /** By category */
  byCategory: z.record(CategorySchema, z.number().int()),
  /** Count of waived findings */
  waived: z.number().int(),
  /** Count of ignored by override */
  ignored: z.number().int(),
});

/**
 * Protection regression - protection removed from a route
 */
export const ProtectionRegressionSchema = z.object({
  /** Route identifier (e.g., "/api/users:POST") */
  routeId: z.string(),
  /** File containing the route */
  file: z.string(),
  /** HTTP method */
  method: z.string(),
  /** Type of protection that was removed */
  protectionType: z.enum(["auth", "validation", "rate-limit", "middleware"]),
  /** Description of what changed */
  description: z.string(),
  /** Related finding fingerprints */
  relatedFingerprints: z.array(z.string()).optional(),
});

/**
 * Semantic regression - abstract security property that regressed
 */
export const SemanticRegressionSchema = z.object({
  /** Type of semantic regression */
  type: z.enum([
    "protection_removed",    // Auth/validation removed from route
    "coverage_decreased",    // Fewer routes protected
    "severity_group_increase", // Multiple findings in same group got worse
  ]),
  /** Severity of this regression */
  severity: SeveritySchema,
  /** Human-readable description */
  description: z.string(),
  /** Route or fingerprint group affected */
  affectedId: z.string(),
  /** Detailed evidence */
  details: z.record(z.unknown()).optional(),
});

/**
 * Regression summary when baseline is provided
 */
export const RegressionSummarySchema = z.object({
  /** Baseline artifact path or identifier */
  baselineId: z.string(),
  /** When baseline was generated */
  baselineGeneratedAt: z.string(),
  /** New findings (not in baseline) */
  newFindings: z.array(z.object({
    findingId: z.string(),
    fingerprint: z.string(),
    severity: SeveritySchema,
    ruleId: z.string(),
    title: z.string(),
  })),
  /** Resolved findings (in baseline but not current) */
  resolvedFindings: z.array(z.object({
    fingerprint: z.string(),
    severity: SeveritySchema,
    ruleId: z.string(),
    title: z.string(),
  })),
  /** Persisting findings (in both) */
  persistingCount: z.number().int(),
  /** Severity regressions (same fingerprint but higher severity) */
  severityRegressions: z.array(z.object({
    fingerprint: z.string(),
    ruleId: z.string(),
    previousSeverity: SeveritySchema,
    currentSeverity: SeveritySchema,
    title: z.string(),
  })),
  /** Net change in finding count */
  netChange: z.number().int(),
  /** Protection regressions (auth/validation removed from routes) */
  protectionRegressions: z.array(ProtectionRegressionSchema).optional(),
  /** Semantic regressions (abstract security property degradations) */
  semanticRegressions: z.array(SemanticRegressionSchema).optional(),
});

/**
 * Waived finding entry in report
 */
export const WaivedFindingSchema = z.object({
  /** The finding that was waived */
  finding: z.object({
    id: z.string(),
    fingerprint: z.string(),
    ruleId: z.string(),
    severity: SeveritySchema,
    title: z.string(),
  }),
  /** The waiver that matched */
  waiver: WaiverSchema,
  /** Whether waiver is expired */
  expired: z.boolean(),
});

/**
 * Policy evaluation report
 */
export const PolicyReportSchema = z.object({
  /** Report schema version */
  policyVersion: z.literal(POLICY_REPORT_VERSION),
  /** When evaluation was performed */
  evaluatedAt: z.string().datetime(),
  /** Profile name used */
  profileName: ProfileNameSchema.nullable(),
  /** Final status */
  status: PolicyStatusSchema,
  /** Thresholds applied */
  thresholds: ThresholdsSchema,
  /** Overrides applied */
  overrides: z.array(OverrideSchema),
  /** Regression policy applied */
  regressionPolicy: RegressionPolicySchema,
  /** Summary counts */
  summary: PolicySummaryCountsSchema,
  /** Reasons for the status */
  reasons: z.array(PolicyReasonSchema),
  /** Regression summary (if baseline provided) */
  regression: RegressionSummarySchema.optional(),
  /** Waived findings */
  waivedFindings: z.array(WaivedFindingSchema),
  /** Active (non-waived, non-ignored) findings included in evaluation */
  activeFindings: z.array(z.object({
    id: z.string(),
    fingerprint: z.string(),
    ruleId: z.string(),
    severity: SeveritySchema,
    originalSeverity: SeveritySchema.optional(),
    confidence: z.number(),
    title: z.string(),
    category: CategorySchema,
    evidencePaths: z.array(z.string()),
  })),
  /** Recommended exit code (0 = pass/warn, 1 = fail) */
  exitCode: z.union([z.literal(0), z.literal(1)]),
  /** Source artifact info */
  artifact: z.object({
    path: z.string().optional(),
    generatedAt: z.string(),
    repoName: z.string().optional(),
  }),
});

export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;
export type PolicyReason = z.infer<typeof PolicyReasonSchema>;
export type PolicySummaryCounts = z.infer<typeof PolicySummaryCountsSchema>;
export type ProtectionRegression = z.infer<typeof ProtectionRegressionSchema>;
export type SemanticRegression = z.infer<typeof SemanticRegressionSchema>;
export type RegressionSummary = z.infer<typeof RegressionSummarySchema>;
export type WaivedFinding = z.infer<typeof WaivedFindingSchema>;
export type PolicyReport = z.infer<typeof PolicyReportSchema>;

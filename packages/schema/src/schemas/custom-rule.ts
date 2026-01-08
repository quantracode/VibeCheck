import { z } from "zod";
import { SeveritySchema, CategorySchema } from "./finding.js";

/**
 * File type filter for custom rules
 */
export const FileTypeSchema = z.enum([
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "env",
  "yaml",
  "yml",
  "md",
  "config",
  "any",
]);

/**
 * Match condition types
 */
export const MatchConditionSchema = z.object({
  /** String or regex pattern to search for */
  contains: z.string().optional(),
  /** Pattern that should NOT be present (for checking missing security controls) */
  not_contains: z.string().optional(),
  /** Regex pattern to match (advanced) */
  regex: z.string().optional(),
  /** Require the match to be case-sensitive (default: false) */
  case_sensitive: z.boolean().optional().default(false),
  /** Require ALL conditions to match (default: true for contains, false for not_contains) */
  all_must_match: z.boolean().optional(),
});

/**
 * File filter configuration
 */
export const FileFilterSchema = z.object({
  /** File types to include (e.g., ["ts", "js"]) */
  file_type: z.array(FileTypeSchema).optional(),
  /** Glob patterns to include */
  include: z.array(z.string()).optional(),
  /** Glob patterns to exclude */
  exclude: z.array(z.string()).optional(),
  /** Only match files in specific directories */
  directories: z.array(z.string()).optional(),
});

/**
 * Context-based condition for more sophisticated matching
 */
export const ContextConditionSchema = z.object({
  /** Match only in specific function/handler types */
  in_function: z.array(z.enum([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "route_handler",
    "middleware",
    "any",
  ])).optional(),
  /** Require presence of imports */
  requires_import: z.array(z.string()).optional(),
  /** Exclude if imports are present */
  excludes_import: z.array(z.string()).optional(),
  /** Only match if file contains certain keywords */
  file_contains: z.array(z.string()).optional(),
  /** Only match if file does NOT contain certain keywords */
  file_not_contains: z.array(z.string()).optional(),
});

/**
 * Custom security rule definition
 */
export const CustomRuleSchema = z.object({
  /** Unique rule identifier (e.g., "VC-CUSTOM-001" or "MY-RULE-001") */
  id: z.string().regex(/^[A-Z]+-[A-Z]+-\d{3,}$/, {
    message: "Rule ID must match pattern XXX-XXX-000 (e.g., VC-CUSTOM-001)",
  }),

  /** Rule version for tracking updates */
  version: z.string().optional().default("1.0.0"),

  /** Severity level */
  severity: SeveritySchema,

  /** Confidence score (0.0 - 1.0) */
  confidence: z.number().min(0).max(1).default(0.8),

  /** Category */
  category: CategorySchema,

  /** Human-readable title */
  title: z.string().min(1),

  /** Detailed description of the security issue */
  description: z.string().min(1),

  /** File filters to limit where the rule applies */
  files: FileFilterSchema.optional(),

  /** Match conditions - what to look for */
  match: MatchConditionSchema,

  /** Context conditions for more sophisticated matching */
  context: ContextConditionSchema.optional(),

  /** Recommended fix explanation */
  recommended_fix: z.string(),

  /** Optional code patch in unified diff format */
  patch: z.string().optional(),

  /** Reference links */
  links: z.object({
    owasp: z.string().url().optional(),
    cwe: z.string().url().optional(),
    documentation: z.string().url().optional(),
  }).optional(),

  /** Optional metadata */
  metadata: z.object({
    /** Author of the rule */
    author: z.string().optional(),
    /** Tags for categorization */
    tags: z.array(z.string()).optional(),
    /** Creation date */
    created: z.string().optional(),
    /** Last updated date */
    updated: z.string().optional(),
  }).optional(),

  /** Whether the rule is enabled (default: true) */
  enabled: z.boolean().optional().default(true),
});

/**
 * Collection of custom rules (for YAML files with multiple rules)
 */
export const CustomRuleCollectionSchema = z.object({
  /** Schema version */
  schema_version: z.string().optional().default("1.0"),
  /** Array of rules */
  rules: z.array(CustomRuleSchema),
});

export type FileType = z.infer<typeof FileTypeSchema>;
export type MatchCondition = z.infer<typeof MatchConditionSchema>;
export type FileFilter = z.infer<typeof FileFilterSchema>;
export type ContextCondition = z.infer<typeof ContextConditionSchema>;
export type CustomRule = z.infer<typeof CustomRuleSchema>;
export type CustomRuleCollection = z.infer<typeof CustomRuleCollectionSchema>;

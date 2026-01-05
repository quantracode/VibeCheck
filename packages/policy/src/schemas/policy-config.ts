import { z } from "zod";
import { SeveritySchema, CategorySchema } from "@vibecheck/schema";

/**
 * Policy profile names
 */
export const ProfileNameSchema = z.enum(["startup", "strict", "compliance-lite"]);

/**
 * Threshold configuration
 */
export const ThresholdsSchema = z.object({
  /** Minimum severity to trigger FAIL status */
  failOnSeverity: SeveritySchema.default("high"),
  /** Minimum severity to trigger WARN status */
  warnOnSeverity: SeveritySchema.default("medium"),
  /** Minimum confidence (0-1) for a finding to trigger FAIL */
  minConfidenceForFail: z.number().min(0).max(1).default(0.7),
  /** Minimum confidence (0-1) for a finding to trigger WARN */
  minConfidenceForWarn: z.number().min(0).max(1).default(0.5),
  /** Special lower confidence threshold for critical findings */
  minConfidenceCritical: z.number().min(0).max(1).default(0.5),
  /** Maximum number of findings before auto-fail (0 = unlimited) */
  maxFindings: z.number().int().min(0).default(0),
  /** Maximum number of critical findings before auto-fail (0 = unlimited) */
  maxCritical: z.number().int().min(0).default(0),
  /** Maximum number of high findings before auto-fail (0 = unlimited) */
  maxHigh: z.number().int().min(0).default(0),
});

/**
 * Override action: what to do when override matches
 */
export const OverrideActionSchema = z.enum([
  "ignore",      // Skip this finding entirely
  "downgrade",   // Treat as lower severity
  "upgrade",     // Treat as higher severity
  "warn-only",   // Never fail, only warn
  "fail",        // Always fail on this
]);

/**
 * Override entry for customizing behavior
 */
export const OverrideSchema = z.object({
  /** Rule ID pattern (exact or prefix like "VC-AUTH-*") */
  ruleId: z.string().optional(),
  /** Category to match */
  category: CategorySchema.optional(),
  /** Path pattern for evidence file matching (glob-like) */
  pathPattern: z.string().optional(),
  /** Action to take when matched */
  action: OverrideActionSchema,
  /** Override severity when action is downgrade/upgrade */
  severity: SeveritySchema.optional(),
  /** Comment explaining the override */
  comment: z.string().optional(),
});

/**
 * Regression policy configuration
 */
export const RegressionPolicySchema = z.object({
  /** Fail on any new high/critical findings */
  failOnNewHighCritical: z.boolean().default(true),
  /** Fail on any severity regression (e.g., medium became high) */
  failOnSeverityRegression: z.boolean().default(false),
  /** Fail on net increase in findings */
  failOnNetIncrease: z.boolean().default(false),
  /** Warn on any new findings */
  warnOnNewFindings: z.boolean().default(true),
  /** Fail on protection removed from routes (auth/validation coverage decreased) */
  failOnProtectionRemoved: z.boolean().default(false),
  /** Warn on protection removed from routes */
  warnOnProtectionRemoved: z.boolean().default(true),
  /** Fail on any semantic regression (coverage decrease, severity group increase) */
  failOnSemanticRegression: z.boolean().default(false),
});

/**
 * Full policy configuration
 */
export const PolicyConfigSchema = z.object({
  /** Profile name for presets */
  profile: ProfileNameSchema.optional(),
  /** Threshold configuration */
  thresholds: ThresholdsSchema.default({}),
  /** Override rules */
  overrides: z.array(OverrideSchema).default([]),
  /** Regression policy */
  regression: RegressionPolicySchema.default({}),
});

/**
 * Config file format (vibecheck.config.json)
 */
export const ConfigFileSchema = z.object({
  /** Policy configuration */
  policy: PolicyConfigSchema.optional(),
  /** Path to waivers file */
  waiversPath: z.string().optional(),
});

export type ProfileName = z.infer<typeof ProfileNameSchema>;
export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type OverrideAction = z.infer<typeof OverrideActionSchema>;
export type Override = z.infer<typeof OverrideSchema>;
export type RegressionPolicy = z.infer<typeof RegressionPolicySchema>;
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;

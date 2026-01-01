import { z } from "zod";
import { FindingSchema } from "./finding.js";

export const ARTIFACT_VERSION = "0.1" as const;

export const ArtifactVersionSchema = z.literal(ARTIFACT_VERSION);

export const ToolInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const GitInfoSchema = z.object({
  branch: z.string().optional(),
  commit: z.string().optional(),
  remoteUrl: z.string().optional(),
  isDirty: z.boolean().optional(),
});

export const RepoInfoSchema = z.object({
  name: z.string(),
  rootPathHash: z.string(),
  git: GitInfoSchema.optional(),
});

export const SeverityCountsSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
});

export const CategoryCountsSchema = z.object({
  auth: z.number().int().nonnegative(),
  validation: z.number().int().nonnegative(),
  middleware: z.number().int().nonnegative(),
  secrets: z.number().int().nonnegative(),
  injection: z.number().int().nonnegative(),
  privacy: z.number().int().nonnegative(),
  config: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
});

export const SummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  bySeverity: SeverityCountsSchema,
  byCategory: CategoryCountsSchema,
});

export const RouteEntrySchema = z.object({
  method: z.string(),
  path: z.string(),
  handler: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  middleware: z.array(z.string()).optional(),
});

export const MiddlewareEntrySchema = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  appliesTo: z.array(z.string()).optional(),
});

export const MetricsSchema = z.object({
  filesScanned: z.number().int().nonnegative(),
  linesOfCode: z.number().int().nonnegative(),
  scanDurationMs: z.number().nonnegative(),
  rulesExecuted: z.number().int().nonnegative(),
});

export const ScanArtifactSchema = z.object({
  artifactVersion: ArtifactVersionSchema,
  generatedAt: z.string().datetime(),
  tool: ToolInfoSchema,
  repo: RepoInfoSchema.optional(),
  summary: SummarySchema,
  findings: z.array(FindingSchema),
  routeMap: z.array(RouteEntrySchema).optional(),
  middlewareMap: z.array(MiddlewareEntrySchema).optional(),
  proofTraces: z
    .record(z.string(), z.object({ summary: z.string() }))
    .optional(),
  metrics: MetricsSchema.optional(),
});

export type ToolInfo = z.infer<typeof ToolInfoSchema>;
export type GitInfo = z.infer<typeof GitInfoSchema>;
export type RepoInfo = z.infer<typeof RepoInfoSchema>;
export type SeverityCounts = z.infer<typeof SeverityCountsSchema>;
export type CategoryCounts = z.infer<typeof CategoryCountsSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type RouteEntry = z.infer<typeof RouteEntrySchema>;
export type MiddlewareEntry = z.infer<typeof MiddlewareEntrySchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type ScanArtifact = z.infer<typeof ScanArtifactSchema>;

/**
 * Computes summary counts from an array of findings
 */
export function computeSummary(findings: z.infer<typeof FindingSchema>[]): z.infer<typeof SummarySchema> {
  const bySeverity: z.infer<typeof SeverityCountsSchema> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byCategory: z.infer<typeof CategoryCountsSchema> = {
    auth: 0,
    validation: 0,
    middleware: 0,
    secrets: 0,
    injection: 0,
    privacy: 0,
    config: 0,
    other: 0,
  };

  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byCategory[finding.category]++;
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
  };
}

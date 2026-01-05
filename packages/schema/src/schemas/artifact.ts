import { z } from "zod";
import { FindingSchema } from "./finding.js";
import { ClaimTypeSchema, ClaimSourceSchema, ClaimScopeSchema, ClaimStrengthSchema } from "./claim.js";
import { ProofTraceSchema } from "./proof-trace.js";
import { SupplyChainInfoSchema } from "./supply-chain.js";

// Support 0.1, 0.2, and 0.3 artifact versions
export const ARTIFACT_VERSION = "0.3" as const;
export const SUPPORTED_VERSIONS = ["0.1", "0.2", "0.3"] as const;

export const ArtifactVersionSchema = z.enum(SUPPORTED_VERSIONS);

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
  network: z.number().int().nonnegative(),
  crypto: z.number().int().nonnegative(),
  uploads: z.number().int().nonnegative(),
  hallucinations: z.number().int().nonnegative(),
  abuse: z.number().int().nonnegative(),
  // Phase 4 categories
  correlation: z.number().int().nonnegative(),
  authorization: z.number().int().nonnegative(),
  lifecycle: z.number().int().nonnegative(),
  "supply-chain": z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
});

export const SummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  bySeverity: SeverityCountsSchema,
  byCategory: CategoryCountsSchema,
});

// Phase 3: Enhanced Route Entry
export const RouteEntrySchema = z.object({
  routeId: z.string(),
  method: z.string(),
  path: z.string(),
  handler: z.string().optional(),
  file: z.string(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  handlerSymbol: z.string().optional(),
  // Deprecated: for backward compat with 0.1
  line: z.number().int().positive().optional(),
  middleware: z.array(z.string()).optional(),
});

// Phase 3: Middleware Coverage Entry
export const MiddlewareCoverageEntrySchema = z.object({
  routeId: z.string(),
  covered: z.boolean(),
  reason: z.string().optional(),
});

// Phase 3: Enhanced Middleware Entry with coverage
export const MiddlewareEntrySchema = z.object({
  name: z.string().optional(),
  file: z.string(),
  line: z.number().int().positive().optional(),
  matcher: z.array(z.string()).optional(),
  appliesTo: z.array(z.string()).optional(),
});

// Phase 3: Middleware Map
export const MiddlewareMapSchema = z.object({
  middlewareFile: z.string().optional(),
  matcher: z.array(z.string()),
  coverage: z.array(MiddlewareCoverageEntrySchema),
});

// Phase 3: Intent Entry for intentMap
export const IntentEntrySchema = z.object({
  intentId: z.string(),
  type: ClaimTypeSchema,
  scope: ClaimScopeSchema,
  targetRouteId: z.string().optional(),
  source: ClaimSourceSchema,
  location: z.object({
    file: z.string(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  }),
  strength: ClaimStrengthSchema,
  textEvidence: z.string(),
});

// Phase 3: Intent Map
export const IntentMapSchema = z.object({
  intents: z.array(IntentEntrySchema),
});

// Phase 3: Route Map
export const RouteMapSchema = z.object({
  routes: z.array(RouteEntrySchema),
});

// Phase 3: Extended Metrics with coverage stats
export const CoverageMetricsSchema = z.object({
  authCoverage: z.object({
    totalStateChanging: z.number().int().nonnegative(),
    protectedCount: z.number().int().nonnegative(),
    unprotectedCount: z.number().int().nonnegative(),
  }).optional(),
  validationCoverage: z.object({
    totalStateChanging: z.number().int().nonnegative(),
    validatedCount: z.number().int().nonnegative(),
  }).optional(),
  middlewareCoverage: z.object({
    totalApiRoutes: z.number().int().nonnegative(),
    coveredApiRoutes: z.number().int().nonnegative(),
  }).optional(),
});

export const MetricsSchema = z.object({
  filesScanned: z.number().int().nonnegative(),
  linesOfCode: z.number().int().nonnegative(),
  scanDurationMs: z.number().nonnegative(),
  rulesExecuted: z.number().int().nonnegative(),
}).merge(CoverageMetricsSchema);

// Phase 4: CI Badge Metadata
export const CIMetadataSchema = z.object({
  /** Security score (0-100) */
  securityScore: z.number().int().min(0).max(100),
  /** Overall status for CI badge */
  status: z.enum(["pass", "warn", "fail"]),
  /** Badge generation timestamp */
  badgeGeneratedAt: z.string().datetime().optional(),
  /** SHA-256 hash for determinism certification */
  artifactHash: z.string().optional(),
  /** Whether artifact passed determinism certification */
  deterministicCertified: z.boolean().optional(),
});

// Phase 4: Correlation Summary
export const CorrelationSummarySchema = z.object({
  /** Total number of correlation findings generated */
  totalCorrelations: z.number().int().nonnegative(),
  /** Count by correlation pattern */
  byPattern: z.record(z.string(), z.number().int().nonnegative()),
  /** Correlation pass duration in ms */
  correlationDurationMs: z.number().nonnegative().optional(),
});

// Phase 4: Graph Node for proof trace visualization
export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["route", "middleware", "finding", "intent", "function"]),
  label: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Phase 4: Graph Edge for proof trace visualization
export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(["calls", "protects", "validates", "correlates", "references"]),
  label: z.string().optional(),
});

// Phase 4: Proof Trace Graph for visualization
export const ProofTraceGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export const ScanArtifactSchema = z.object({
  artifactVersion: ArtifactVersionSchema,
  generatedAt: z.string().datetime(),
  tool: ToolInfoSchema,
  repo: RepoInfoSchema.optional(),
  summary: SummarySchema,
  findings: z.array(FindingSchema),
  // Phase 3: Enhanced maps
  routeMap: z.union([
    z.array(RouteEntrySchema), // Legacy format (0.1)
    RouteMapSchema,            // New format (0.2)
  ]).optional(),
  middlewareMap: z.union([
    z.array(MiddlewareEntrySchema), // Legacy format (0.1)
    MiddlewareMapSchema,            // New format (0.2)
  ]).optional(),
  intentMap: IntentMapSchema.optional(),
  proofTraces: z.record(z.string(), ProofTraceSchema).optional(),
  metrics: MetricsSchema.optional(),
  // Phase 4: Supply chain analysis
  supplyChainInfo: SupplyChainInfoSchema.optional(),
  // Phase 4: CI badge metadata
  ciMetadata: CIMetadataSchema.optional(),
  // Phase 4: Correlation summary
  correlationSummary: CorrelationSummarySchema.optional(),
  // Phase 4: Proof trace graph for visualization
  graph: ProofTraceGraphSchema.optional(),
});

export type ToolInfo = z.infer<typeof ToolInfoSchema>;
export type GitInfo = z.infer<typeof GitInfoSchema>;
export type RepoInfo = z.infer<typeof RepoInfoSchema>;
export type SeverityCounts = z.infer<typeof SeverityCountsSchema>;
export type CategoryCounts = z.infer<typeof CategoryCountsSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type RouteEntry = z.infer<typeof RouteEntrySchema>;
export type MiddlewareEntry = z.infer<typeof MiddlewareEntrySchema>;
export type MiddlewareCoverageEntry = z.infer<typeof MiddlewareCoverageEntrySchema>;
export type MiddlewareMap = z.infer<typeof MiddlewareMapSchema>;
export type IntentEntry = z.infer<typeof IntentEntrySchema>;
export type IntentMap = z.infer<typeof IntentMapSchema>;
export type RouteMap = z.infer<typeof RouteMapSchema>;
export type CoverageMetrics = z.infer<typeof CoverageMetricsSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type CIMetadata = z.infer<typeof CIMetadataSchema>;
export type CorrelationSummary = z.infer<typeof CorrelationSummarySchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type ProofTraceGraph = z.infer<typeof ProofTraceGraphSchema>;
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
    network: 0,
    crypto: 0,
    uploads: 0,
    hallucinations: 0,
    abuse: 0,
    // Phase 4 categories
    correlation: 0,
    authorization: 0,
    lifecycle: 0,
    "supply-chain": 0,
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

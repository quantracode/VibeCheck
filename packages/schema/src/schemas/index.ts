// Claim schemas and types
export {
  ClaimTypeSchema,
  ClaimSourceSchema,
  ClaimScopeSchema,
  ClaimStrengthSchema,
  ClaimLocationSchema,
  ClaimSchema,
  type ClaimType,
  type ClaimSource,
  type ClaimScope,
  type ClaimStrength,
  type ClaimLocation,
  type Claim,
} from "./claim.js";

// Evidence schemas and types
export { EvidenceItemSchema, type EvidenceItem } from "./evidence.js";

// Proof trace schemas and types
export {
  ProofNodeKindSchema,
  ProofNodeSchema,
  ProofTraceSchema,
  type ProofNodeKind,
  type ProofNode,
  type ProofTrace,
} from "./proof-trace.js";

// Finding schemas and types
export {
  SeveritySchema,
  CategorySchema,
  RemediationSchema,
  ReferenceLinksSchema,
  AbuseRiskSchema,
  AbuseCategorySchema,
  AbuseClassificationSchema,
  CorrelationPatternSchema,
  CorrelationDataSchema,
  FindingSchema,
  type Severity,
  type Category,
  type Remediation,
  type ReferenceLinks,
  type AbuseRisk,
  type AbuseCategory,
  type AbuseClassification,
  type CorrelationPattern,
  type CorrelationData,
  type Finding,
} from "./finding.js";

// Supply chain schemas and types (Phase 4)
export {
  DependencyRiskIndicatorSchema,
  DependencyInfoSchema,
  LockfileInfoSchema,
  PackageJsonInfoSchema,
  SupplyChainInfoSchema,
  type DependencyRiskIndicator,
  type DependencyInfo,
  type LockfileInfo,
  type PackageJsonInfo,
  type SupplyChainInfo,
} from "./supply-chain.js";

// Artifact schemas and types
export {
  ARTIFACT_VERSION,
  SUPPORTED_VERSIONS,
  ArtifactVersionSchema,
  ToolInfoSchema,
  GitInfoSchema,
  RepoInfoSchema,
  SeverityCountsSchema,
  CategoryCountsSchema,
  SummarySchema,
  RouteEntrySchema,
  MiddlewareEntrySchema,
  MiddlewareCoverageEntrySchema,
  MiddlewareMapSchema,
  IntentEntrySchema,
  IntentMapSchema,
  RouteMapSchema,
  CoverageMetricsSchema,
  MetricsSchema,
  CIMetadataSchema,
  // Phase 4 schemas
  CorrelationSummarySchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  ProofTraceGraphSchema,
  ScanArtifactSchema,
  computeSummary,
  type ToolInfo,
  type GitInfo,
  type RepoInfo,
  type SeverityCounts,
  type CategoryCounts,
  type Summary,
  type RouteEntry,
  type MiddlewareEntry,
  type MiddlewareCoverageEntry,
  type MiddlewareMap,
  type IntentEntry,
  type IntentMap,
  type RouteMap,
  type CoverageMetrics,
  type Metrics,
  type CIMetadata,
  // Phase 4 types
  type CorrelationSummary,
  type GraphNode,
  type GraphEdge,
  type ProofTraceGraph,
  type ScanArtifact,
} from "./artifact.js";

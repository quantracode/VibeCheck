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
  FindingSchema,
  type Severity,
  type Category,
  type Remediation,
  type ReferenceLinks,
  type Finding,
} from "./finding.js";

// Artifact schemas and types
export {
  ARTIFACT_VERSION,
  ArtifactVersionSchema,
  ToolInfoSchema,
  GitInfoSchema,
  RepoInfoSchema,
  SeverityCountsSchema,
  CategoryCountsSchema,
  SummarySchema,
  RouteEntrySchema,
  MiddlewareEntrySchema,
  MetricsSchema,
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
  type Metrics,
  type ScanArtifact,
} from "./artifact.js";

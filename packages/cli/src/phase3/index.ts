/**
 * Phase 3: Hallucination Detection Engine
 *
 * Cross-file proof traces, intent claim mining, and hallucination detection.
 * All deterministic, local-only.
 */

// Proof trace builder
export {
  generateRouteId,
  filePathToRoutePath,
  buildRouteMap,
  buildMiddlewareMap,
  isRouteCoveredByMiddleware,
  buildProofTrace,
  buildAllProofTraces,
  calculateCoverage,
} from "./proof-trace-builder.js";

// Intent claim miner
export {
  generateIntentId,
  mineIntentClaims,
  mineAllIntentClaims,
  findClaimsForRoute,
  findUnprovenClaims,
} from "./intent-miner.js";

// Scanners
export {
  phase3Scanners,
  hallucinationsPack,
  authPackPhase3,
  scanCommentClaimUnproven,
  scanMiddlewareAssumedNotMatching,
  scanValidationClaimedMissing,
  scanAuthByUiServerGap,
} from "./scanners/index.js";

// Re-export types
export type {
  RouteInfo,
  MiddlewareInfo,
  IntentClaim,
  IntentClaimType,
  IntentClaimSource,
  IntentClaimScope,
  IntentClaimStrength,
  ProofTrace,
  ProofTraceStep,
  CoverageMetrics,
  Phase3Context,
} from "../scanners/types.js";

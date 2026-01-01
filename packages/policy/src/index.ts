// Export schemas and types
export * from "./schemas/index.js";

// Export severity utilities
export {
  SEVERITY_ORDER,
  SEVERITY_LEVELS,
  compareSeverity,
  severityMeetsThreshold,
  lowerSeverity,
  higherSeverity,
} from "./severity.js";

// Export profiles
export {
  getProfile,
  DEFAULT_PROFILE,
  PROFILE_NAMES,
  PROFILE_DESCRIPTIONS,
} from "./profiles.js";

// Export waiver utilities
export {
  matchRuleId,
  matchPathPattern,
  isWaiverExpired,
  matchWaiver,
  findMatchingWaiver,
  applyWaivers,
  createEmptyWaiversFile,
  generateWaiverId,
  createWaiver,
  addWaiver,
  removeWaiver,
} from "./waivers.js";

// Export regression utilities
export {
  computeRegression,
  isSeverityRegression,
  hasNewHighCritical,
  getNewHighCriticalIds,
  hasSeverityRegressions,
  hasNetIncrease,
} from "./regression.js";

// Export evaluator
export {
  evaluate,
  mergeConfigs,
  type EvaluateInput,
  type UserConfigInput,
} from "./evaluator.js";

// Re-export useful types from schema
export type { Finding, Severity, Category, ScanArtifact } from "@vibecheck/schema";

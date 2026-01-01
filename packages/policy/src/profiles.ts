import type { PolicyConfig, ProfileName, Thresholds, RegressionPolicy } from "./schemas/index.js";

/**
 * Startup profile - balanced for early-stage projects
 * More lenient on existing issues, strict on new critical/high
 */
const STARTUP_THRESHOLDS: Thresholds = {
  failOnSeverity: "critical",
  warnOnSeverity: "high",
  minConfidenceForFail: 0.7,
  minConfidenceForWarn: 0.5,
  minConfidenceCritical: 0.5,
  maxFindings: 0,
  maxCritical: 0,
  maxHigh: 0,
};

const STARTUP_REGRESSION: RegressionPolicy = {
  failOnNewHighCritical: true,
  failOnSeverityRegression: false,
  failOnNetIncrease: false,
  warnOnNewFindings: true,
};

const STARTUP_PROFILE: PolicyConfig = {
  profile: "startup",
  thresholds: STARTUP_THRESHOLDS,
  overrides: [],
  regression: STARTUP_REGRESSION,
};

/**
 * Strict profile - for production-ready projects
 * Fails on any high or critical, warns on medium
 */
const STRICT_THRESHOLDS: Thresholds = {
  failOnSeverity: "high",
  warnOnSeverity: "medium",
  minConfidenceForFail: 0.6,
  minConfidenceForWarn: 0.4,
  minConfidenceCritical: 0.4,
  maxFindings: 0,
  maxCritical: 0,
  maxHigh: 0,
};

const STRICT_REGRESSION: RegressionPolicy = {
  failOnNewHighCritical: true,
  failOnSeverityRegression: true,
  failOnNetIncrease: false,
  warnOnNewFindings: true,
};

const STRICT_PROFILE: PolicyConfig = {
  profile: "strict",
  thresholds: STRICT_THRESHOLDS,
  overrides: [],
  regression: STRICT_REGRESSION,
};

/**
 * Compliance-lite profile - focuses on security compliance basics
 * More forgiving on low-confidence findings, stricter on categories
 */
const COMPLIANCE_LITE_THRESHOLDS: Thresholds = {
  failOnSeverity: "high",
  warnOnSeverity: "medium",
  minConfidenceForFail: 0.8,
  minConfidenceForWarn: 0.6,
  minConfidenceCritical: 0.6,
  maxFindings: 50,
  maxCritical: 0,
  maxHigh: 5,
};

const COMPLIANCE_LITE_REGRESSION: RegressionPolicy = {
  failOnNewHighCritical: true,
  failOnSeverityRegression: true,
  failOnNetIncrease: true,
  warnOnNewFindings: true,
};

const COMPLIANCE_LITE_PROFILE: PolicyConfig = {
  profile: "compliance-lite",
  thresholds: COMPLIANCE_LITE_THRESHOLDS,
  overrides: [],
  regression: COMPLIANCE_LITE_REGRESSION,
};

/**
 * Get a predefined profile by name
 */
export function getProfile(name: ProfileName): PolicyConfig {
  switch (name) {
    case "startup":
      return { ...STARTUP_PROFILE };
    case "strict":
      return { ...STRICT_PROFILE };
    case "compliance-lite":
      return { ...COMPLIANCE_LITE_PROFILE };
    default:
      return { ...STARTUP_PROFILE };
  }
}

/**
 * Default profile name
 */
export const DEFAULT_PROFILE: ProfileName = "startup";

/**
 * All available profile names
 */
export const PROFILE_NAMES: ProfileName[] = ["startup", "strict", "compliance-lite"];

/**
 * Profile descriptions for help text
 */
export const PROFILE_DESCRIPTIONS: Record<ProfileName, string> = {
  startup: "Balanced for early-stage projects. Fails on critical, warns on high.",
  strict: "Production-ready. Fails on high/critical, warns on medium.",
  "compliance-lite": "Compliance-focused. Stricter count limits, higher confidence thresholds.",
};

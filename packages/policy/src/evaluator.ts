import micromatch from "micromatch";
import type { Finding, Severity, Category, ScanArtifact } from "@vibecheck/schema";
import type {
  PolicyConfig,
  PolicyReport,
  PolicyStatus,
  PolicyReason,
  PolicySummaryCounts,
  Override,
  Thresholds,
  RegressionPolicy,
  WaivedFinding,
  RegressionSummary,
  ProfileName,
} from "./schemas/index.js";
import { POLICY_REPORT_VERSION } from "./schemas/index.js";
import { getProfile, DEFAULT_PROFILE } from "./profiles.js";
import { severityMeetsThreshold, SEVERITY_ORDER, lowerSeverity, higherSeverity } from "./severity.js";
import { applyWaivers, matchRuleId, matchPathPattern } from "./waivers.js";
import {
  computeRegression,
  hasNewHighCritical,
  getNewHighCriticalIds,
  hasSeverityRegressions,
  hasNetIncrease,
  hasProtectionRegressions,
  hasSemanticRegressions,
} from "./regression.js";
import type { Waiver } from "./schemas/waiver.js";

/**
 * Processed finding with override effects applied
 */
interface ProcessedFinding {
  finding: Finding;
  originalSeverity: Severity;
  effectiveSeverity: Severity;
  ignored: boolean;
  overrideApplied?: Override;
}

/**
 * Evaluation input
 */
export interface EvaluateInput {
  /** Scan artifact to evaluate */
  artifact: ScanArtifact;
  /** Optional baseline artifact for regression detection */
  baseline?: ScanArtifact;
  /** Policy configuration (profile + overrides) */
  config?: PolicyConfig;
  /** Profile name (uses defaults if no config) */
  profile?: ProfileName;
  /** Waivers to apply */
  waivers?: Waiver[];
  /** Artifact file path (for report) */
  artifactPath?: string;
}

/**
 * Apply overrides to a finding
 */
function applyOverrides(finding: Finding, overrides: Override[]): ProcessedFinding {
  const evidencePaths = finding.evidence.map((e) => e.file);
  let effectiveSeverity = finding.severity;
  let ignored = false;
  let overrideApplied: Override | undefined;

  for (const override of overrides) {
    // Check if override matches
    let matches = false;

    if (override.ruleId) {
      matches = matchRuleId(finding.ruleId, override.ruleId);
    } else if (override.category) {
      matches = finding.category === override.category;
    }

    // If matched so far and path pattern specified, check that too
    if (matches && override.pathPattern) {
      matches = matchPathPattern(evidencePaths, override.pathPattern);
    }

    if (matches) {
      overrideApplied = override;

      switch (override.action) {
        case "ignore":
          ignored = true;
          break;
        case "downgrade":
          effectiveSeverity = override.severity ?? lowerSeverity(finding.severity);
          break;
        case "upgrade":
          effectiveSeverity = override.severity ?? higherSeverity(finding.severity);
          break;
        case "warn-only":
          // Will be handled during status computation
          break;
        case "fail":
          // Will be handled during status computation
          break;
      }
      break; // First matching override wins
    }
  }

  return {
    finding,
    originalSeverity: finding.severity,
    effectiveSeverity,
    ignored,
    overrideApplied,
  };
}

/**
 * Compute summary counts from processed findings
 */
function computeSummaryCounts(
  processed: ProcessedFinding[],
  waivedFindings: WaivedFinding[]
): PolicySummaryCounts {
  const active = processed.filter((p) => !p.ignored);
  const ignored = processed.filter((p) => p.ignored);

  const bySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byCategory: Record<Category, number> = {
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

  for (const p of active) {
    bySeverity[p.effectiveSeverity]++;
    byCategory[p.finding.category]++;
  }

  return {
    total: active.length,
    bySeverity,
    byCategory,
    waived: waivedFindings.length,
    ignored: ignored.length,
  };
}

/**
 * Determine status and reasons from thresholds
 */
function evaluateThresholds(
  processed: ProcessedFinding[],
  thresholds: Thresholds,
  overrides: Override[]
): { status: PolicyStatus; reasons: PolicyReason[] } {
  const reasons: PolicyReason[] = [];
  let status: PolicyStatus = "pass";

  const active = processed.filter((p) => !p.ignored);

  // Check count thresholds
  if (thresholds.maxFindings > 0 && active.length > thresholds.maxFindings) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "count_threshold",
      message: `Total findings (${active.length}) exceeds maximum (${thresholds.maxFindings})`,
      details: { count: active.length, max: thresholds.maxFindings },
    });
  }

  const criticalCount = active.filter((p) => p.effectiveSeverity === "critical").length;
  if (thresholds.maxCritical > 0 && criticalCount > thresholds.maxCritical) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "count_threshold",
      message: `Critical findings (${criticalCount}) exceeds maximum (${thresholds.maxCritical})`,
      details: { count: criticalCount, max: thresholds.maxCritical },
    });
  }

  const highCount = active.filter((p) => p.effectiveSeverity === "high").length;
  if (thresholds.maxHigh > 0 && highCount > thresholds.maxHigh) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "count_threshold",
      message: `High severity findings (${highCount}) exceeds maximum (${thresholds.maxHigh})`,
      details: { count: highCount, max: thresholds.maxHigh },
    });
  }

  // Check each finding against thresholds
  const failFindings: string[] = [];
  const warnFindings: string[] = [];

  for (const p of active) {
    const { finding, effectiveSeverity, overrideApplied } = p;

    // Check for override actions
    if (overrideApplied?.action === "fail") {
      failFindings.push(finding.id);
      continue;
    }
    if (overrideApplied?.action === "warn-only") {
      warnFindings.push(finding.id);
      continue;
    }

    // Determine confidence threshold
    const isCritical = effectiveSeverity === "critical";
    const confidenceForFail = isCritical
      ? thresholds.minConfidenceCritical
      : thresholds.minConfidenceForFail;
    const confidenceForWarn = thresholds.minConfidenceForWarn;

    // Check severity and confidence
    const meetsFail =
      severityMeetsThreshold(effectiveSeverity, thresholds.failOnSeverity) &&
      finding.confidence >= confidenceForFail;

    const meetsWarn =
      severityMeetsThreshold(effectiveSeverity, thresholds.warnOnSeverity) &&
      finding.confidence >= confidenceForWarn;

    if (meetsFail) {
      failFindings.push(finding.id);
    } else if (meetsWarn) {
      warnFindings.push(finding.id);
    }
  }

  // Determine final status
  if (failFindings.length > 0) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "severity_threshold",
      message: `${failFindings.length} finding(s) meet fail criteria`,
      findingIds: failFindings,
    });
  }

  if (warnFindings.length > 0 && status === "pass") {
    status = "warn";
    reasons.push({
      status: "warn",
      code: "severity_threshold",
      message: `${warnFindings.length} finding(s) meet warn criteria`,
      findingIds: warnFindings,
    });
  }

  if (status === "pass") {
    reasons.push({
      status: "pass",
      code: "no_issues",
      message: "No findings meet fail or warn criteria",
    });
  }

  return { status, reasons };
}

/**
 * Evaluate regression policy
 */
function evaluateRegression(
  regression: RegressionSummary,
  policy: RegressionPolicy
): { status: PolicyStatus; reasons: PolicyReason[] } {
  const reasons: PolicyReason[] = [];
  let status: PolicyStatus = "pass";

  // Check for new high/critical
  if (policy.failOnNewHighCritical && hasNewHighCritical(regression)) {
    status = "fail";
    const ids = getNewHighCriticalIds(regression);
    reasons.push({
      status: "fail",
      code: "new_high_critical",
      message: `${ids.length} new high/critical finding(s) detected`,
      findingIds: ids,
    });
  }

  // Check for severity regressions
  if (policy.failOnSeverityRegression && hasSeverityRegressions(regression)) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "severity_regression",
      message: `${regression.severityRegressions.length} severity regression(s) detected`,
      details: {
        regressions: regression.severityRegressions.map((r) => ({
          ruleId: r.ruleId,
          from: r.previousSeverity,
          to: r.currentSeverity,
        })),
      },
    });
  }

  // Check for net increase
  if (policy.failOnNetIncrease && hasNetIncrease(regression)) {
    status = "fail";
    reasons.push({
      status: "fail",
      code: "net_increase",
      message: `Net increase of ${regression.netChange} finding(s)`,
      details: { netChange: regression.netChange },
    });
  }

  // Warn on new findings
  if (
    policy.warnOnNewFindings &&
    regression.newFindings.length > 0 &&
    status === "pass"
  ) {
    status = "warn";
    reasons.push({
      status: "warn",
      code: "severity_threshold",
      message: `${regression.newFindings.length} new finding(s) detected`,
      findingIds: regression.newFindings.map((f) => f.findingId),
    });
  }

  // Check for protection regressions (new semantic feature)
  if (hasProtectionRegressions(regression)) {
    const protectionRegs = regression.protectionRegressions || [];

    if (policy.failOnProtectionRemoved) {
      status = "fail";
      reasons.push({
        status: "fail",
        code: "protection_removed",
        message: `${protectionRegs.length} route(s) lost protection coverage`,
        details: {
          regressions: protectionRegs.map((r) => ({
            route: r.routeId,
            protectionType: r.protectionType,
          })),
        },
      });
    } else if (policy.warnOnProtectionRemoved && status === "pass") {
      status = "warn";
      reasons.push({
        status: "warn",
        code: "protection_removed",
        message: `${protectionRegs.length} route(s) may have lost protection`,
        details: {
          regressions: protectionRegs.map((r) => ({
            route: r.routeId,
            protectionType: r.protectionType,
          })),
        },
      });
    }
  }

  // Check for semantic regressions
  if (policy.failOnSemanticRegression && hasSemanticRegressions(regression)) {
    const semanticRegs = regression.semanticRegressions || [];
    status = "fail";
    reasons.push({
      status: "fail",
      code: "semantic_regression",
      message: `${semanticRegs.length} semantic regression(s) detected`,
      details: {
        regressions: semanticRegs.map((r) => ({
          type: r.type,
          severity: r.severity,
          description: r.description,
        })),
      },
    });
  }

  return { status, reasons };
}

/**
 * Merge two statuses (fail > warn > pass)
 */
function mergeStatus(a: PolicyStatus, b: PolicyStatus): PolicyStatus {
  if (a === "fail" || b === "fail") return "fail";
  if (a === "warn" || b === "warn") return "warn";
  return "pass";
}

/**
 * Evaluate a scan artifact against policy
 */
export function evaluate(input: EvaluateInput): PolicyReport {
  const { artifact, baseline, waivers = [], artifactPath } = input;

  // Determine config
  let config: PolicyConfig;
  if (input.config) {
    config = input.config;
  } else if (input.profile) {
    config = getProfile(input.profile);
  } else {
    config = getProfile(DEFAULT_PROFILE);
  }

  const { thresholds, overrides, regression: regressionPolicy } = config;

  // Apply waivers first
  const { activeFindings, waivedFindings } = applyWaivers(artifact.findings, waivers);

  // Apply overrides to active findings
  const processed = activeFindings.map((f) => applyOverrides(f, overrides));

  // Compute summary
  const summary = computeSummaryCounts(processed, waivedFindings);

  // Evaluate thresholds
  const thresholdResult = evaluateThresholds(processed, thresholds, overrides);

  // Evaluate regression if baseline provided
  let regressionSummary: RegressionSummary | undefined;
  let regressionResult: { status: PolicyStatus; reasons: PolicyReason[] } | undefined;

  if (baseline) {
    regressionSummary = computeRegression(artifact, baseline);
    regressionResult = evaluateRegression(regressionSummary, regressionPolicy);
  }

  // Merge statuses
  let finalStatus = thresholdResult.status;
  const allReasons = [...thresholdResult.reasons];

  if (regressionResult) {
    finalStatus = mergeStatus(finalStatus, regressionResult.status);
    allReasons.push(...regressionResult.reasons);
  }

  // Build active findings for report
  const activeForReport = processed
    .filter((p) => !p.ignored)
    .map((p) => ({
      id: p.finding.id,
      fingerprint: p.finding.fingerprint,
      ruleId: p.finding.ruleId,
      severity: p.effectiveSeverity,
      originalSeverity:
        p.effectiveSeverity !== p.originalSeverity ? p.originalSeverity : undefined,
      confidence: p.finding.confidence,
      title: p.finding.title,
      category: p.finding.category,
      evidencePaths: p.finding.evidence.map((e) => e.file),
    }));

  return {
    policyVersion: POLICY_REPORT_VERSION,
    evaluatedAt: new Date().toISOString(),
    profileName: config.profile ?? null,
    status: finalStatus,
    thresholds,
    overrides,
    regressionPolicy,
    summary,
    reasons: allReasons,
    regression: regressionSummary,
    waivedFindings,
    activeFindings: activeForReport,
    exitCode: finalStatus === "fail" ? 1 : 0,
    artifact: {
      path: artifactPath,
      generatedAt: artifact.generatedAt,
      repoName: artifact.repo?.name,
    },
  };
}

/**
 * User config input for merging (supports partial nested objects)
 */
export interface UserConfigInput {
  profile?: ProfileName;
  thresholds?: Partial<Thresholds>;
  overrides?: Override[];
  regression?: Partial<RegressionPolicy>;
}

/**
 * Merge policy configs (user config overrides profile defaults)
 */
export function mergeConfigs(
  profile: PolicyConfig,
  userConfig: UserConfigInput
): PolicyConfig {
  return {
    profile: userConfig.profile ?? profile.profile,
    thresholds: {
      ...profile.thresholds,
      ...userConfig.thresholds,
    },
    overrides: [...profile.overrides, ...(userConfig.overrides ?? [])],
    regression: {
      ...profile.regression,
      ...userConfig.regression,
    },
  };
}

/**
 * Policy evaluation utilities for the UI
 */

import type { ScanArtifact, Finding } from "@vibecheck/schema";
import {
  evaluate,
  PROFILE_NAMES,
  PROFILE_DESCRIPTIONS,
  computeRegression,
  type EvaluateInput,
} from "@vibecheck/policy";
import type { PolicyReport, ProfileName, RegressionSummary } from "@vibecheck/policy";

export { PROFILE_NAMES, PROFILE_DESCRIPTIONS };
export type { PolicyReport, ProfileName, RegressionSummary };

/**
 * Coverage metrics from artifact
 */
export interface CoverageMetrics {
  authCoverage: number;
  validationCoverage: number;
  middlewareCoverage: number;
}

/**
 * Coverage regression info
 */
export interface CoverageRegression {
  metric: "auth" | "validation" | "middleware";
  baseline: number;
  current: number;
  delta: number;
  isRegression: boolean;
}

/**
 * Extended regression info including coverage
 */
export interface ExtendedRegressionInfo {
  regression: RegressionSummary | null;
  coverageRegressions: CoverageRegression[];
  hasCoverageRegression: boolean;
}

/**
 * Extract coverage metrics from artifact
 */
export function extractCoverageMetrics(artifact: ScanArtifact): CoverageMetrics | null {
  const metrics = artifact.metrics;
  if (!metrics) return null;

  return {
    authCoverage: typeof metrics.authCoverage === "number" ? metrics.authCoverage : 0,
    validationCoverage: typeof metrics.validationCoverage === "number" ? metrics.validationCoverage : 0,
    middlewareCoverage: typeof metrics.middlewareCoverage === "number" ? metrics.middlewareCoverage : 0,
  };
}

/**
 * Compute coverage regressions between two artifacts
 */
export function computeCoverageRegressions(
  current: ScanArtifact,
  baseline: ScanArtifact
): CoverageRegression[] {
  const currentMetrics = extractCoverageMetrics(current);
  const baselineMetrics = extractCoverageMetrics(baseline);

  if (!currentMetrics || !baselineMetrics) {
    return [];
  }

  const regressions: CoverageRegression[] = [];

  const metrics: Array<"auth" | "validation" | "middleware"> = ["auth", "validation", "middleware"];

  for (const metric of metrics) {
    const key = `${metric}Coverage` as keyof CoverageMetrics;
    const currentValue = currentMetrics[key];
    const baselineValue = baselineMetrics[key];
    const delta = currentValue - baselineValue;

    regressions.push({
      metric,
      baseline: baselineValue,
      current: currentValue,
      delta,
      isRegression: delta < -5, // Consider 5% drop as regression
    });
  }

  return regressions;
}

/**
 * Compute extended regression info
 */
export function computeExtendedRegression(
  current: ScanArtifact,
  baseline: ScanArtifact | null
): ExtendedRegressionInfo {
  if (!baseline) {
    return {
      regression: null,
      coverageRegressions: [],
      hasCoverageRegression: false,
    };
  }

  const regression = computeRegression(current, baseline);
  const coverageRegressions = computeCoverageRegressions(current, baseline);
  const hasCoverageRegression = coverageRegressions.some((r) => r.isRegression);

  return {
    regression,
    coverageRegressions,
    hasCoverageRegression,
  };
}

/**
 * Evaluate artifact against policy
 */
export function evaluateArtifact(
  artifact: ScanArtifact,
  baseline: ScanArtifact | null,
  profile: ProfileName
): PolicyReport {
  const input: EvaluateInput = {
    artifact,
    baseline: baseline ?? undefined,
    profile,
  };

  return evaluate(input);
}

/**
 * Get status color for policy status
 */
export function getStatusColor(status: "pass" | "warn" | "fail"): string {
  switch (status) {
    case "pass":
      return "emerald";
    case "warn":
      return "yellow";
    case "fail":
      return "red";
  }
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: "pass" | "warn" | "fail"): string {
  switch (status) {
    case "pass":
      return "PASS";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
  }
}

/**
 * Would this result block a deploy?
 */
export function wouldBlockDeploy(report: PolicyReport): boolean {
  return report.status === "fail";
}

/**
 * Format reason message for display
 */
export function formatReasonMessage(reason: PolicyReport["reasons"][0]): string {
  return reason.message;
}

/**
 * Group findings by change type for regression view
 */
export interface GroupedFindings {
  new: Finding[];
  resolved: Array<{ fingerprint: string; severity: string; ruleId: string; title: string }>;
  persisting: Finding[];
  regressions: Array<{
    fingerprint: string;
    ruleId: string;
    previousSeverity: string;
    currentSeverity: string;
    title: string;
  }>;
}

export function groupFindingsByChange(
  currentFindings: Finding[],
  regression: RegressionSummary | null
): GroupedFindings {
  if (!regression) {
    return {
      new: currentFindings,
      resolved: [],
      persisting: [],
      regressions: [],
    };
  }

  const newFingerprints = new Set(regression.newFindings.map((f) => f.fingerprint));
  const resolvedItems = regression.resolvedFindings;
  const regressionItems = regression.severityRegressions;

  const newFindings = currentFindings.filter((f) => newFingerprints.has(f.fingerprint));
  const persistingFindings = currentFindings.filter((f) => !newFingerprints.has(f.fingerprint));

  return {
    new: newFindings,
    resolved: resolvedItems,
    persisting: persistingFindings,
    regressions: regressionItems,
  };
}

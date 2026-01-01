import type { Finding, Severity, ScanArtifact } from "@vibecheck/schema";
import type { RegressionSummary } from "./schemas/index.js";
import { SEVERITY_ORDER } from "./severity.js";

/**
 * Fingerprint index for quick lookup
 */
type FingerprintIndex = Map<string, Finding>;

/**
 * Build a fingerprint index from findings
 */
function buildFingerprintIndex(findings: Finding[]): FingerprintIndex {
  const index = new Map<string, Finding>();
  for (const finding of findings) {
    index.set(finding.fingerprint, finding);
  }
  return index;
}

/**
 * Compare two severities, returns positive if current is worse
 */
export function compareSeverity(current: Severity, baseline: Severity): number {
  return SEVERITY_ORDER[current] - SEVERITY_ORDER[baseline];
}

/**
 * Check if severity is a regression (got worse)
 */
export function isSeverityRegression(current: Severity, baseline: Severity): boolean {
  return compareSeverity(current, baseline) > 0;
}

/**
 * Compute regression summary between current and baseline artifacts
 */
export function computeRegression(
  current: ScanArtifact,
  baseline: ScanArtifact
): RegressionSummary {
  const currentIndex = buildFingerprintIndex(current.findings);
  const baselineIndex = buildFingerprintIndex(baseline.findings);

  const newFindings: RegressionSummary["newFindings"] = [];
  const resolvedFindings: RegressionSummary["resolvedFindings"] = [];
  const severityRegressions: RegressionSummary["severityRegressions"] = [];
  let persistingCount = 0;

  // Find new findings (in current but not baseline)
  for (const [fingerprint, finding] of currentIndex) {
    const baselineFinding = baselineIndex.get(fingerprint);
    if (!baselineFinding) {
      newFindings.push({
        findingId: finding.id,
        fingerprint,
        severity: finding.severity,
        ruleId: finding.ruleId,
        title: finding.title,
      });
    } else {
      persistingCount++;
      // Check for severity regression
      if (isSeverityRegression(finding.severity, baselineFinding.severity)) {
        severityRegressions.push({
          fingerprint,
          ruleId: finding.ruleId,
          previousSeverity: baselineFinding.severity,
          currentSeverity: finding.severity,
          title: finding.title,
        });
      }
    }
  }

  // Find resolved findings (in baseline but not current)
  for (const [fingerprint, finding] of baselineIndex) {
    if (!currentIndex.has(fingerprint)) {
      resolvedFindings.push({
        fingerprint,
        severity: finding.severity,
        ruleId: finding.ruleId,
        title: finding.title,
      });
    }
  }

  const netChange = current.findings.length - baseline.findings.length;

  return {
    baselineId: baseline.repo?.name ?? "unknown",
    baselineGeneratedAt: baseline.generatedAt,
    newFindings,
    resolvedFindings,
    persistingCount,
    severityRegressions,
    netChange,
  };
}

/**
 * Check if regression has new high/critical findings
 */
export function hasNewHighCritical(regression: RegressionSummary): boolean {
  return regression.newFindings.some(
    (f) => f.severity === "critical" || f.severity === "high"
  );
}

/**
 * Get new high/critical finding IDs
 */
export function getNewHighCriticalIds(regression: RegressionSummary): string[] {
  return regression.newFindings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .map((f) => f.findingId);
}

/**
 * Check if regression has severity regressions
 */
export function hasSeverityRegressions(regression: RegressionSummary): boolean {
  return regression.severityRegressions.length > 0;
}

/**
 * Check if regression has net increase
 */
export function hasNetIncrease(regression: RegressionSummary): boolean {
  return regression.netChange > 0;
}

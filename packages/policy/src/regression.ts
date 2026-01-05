import type { Finding, Severity, ScanArtifact } from "@vibecheck/schema";
import type { RegressionSummary, ProtectionRegression, SemanticRegression } from "./schemas/index.js";
import { SEVERITY_ORDER } from "./severity.js";

/**
 * Rule categories that indicate protection types
 */
const PROTECTION_RULE_MAPPING: Record<string, ProtectionRegression["protectionType"]> = {
  "VC-AUTH": "auth",
  "VC-VAL": "validation",
  "VC-RATE": "rate-limit",
  "VC-MW": "middleware",
  "VC-LIFE-001": "auth",
  "VC-LIFE-002": "validation",
  "VC-LIFE-003": "rate-limit",
};

/**
 * Extract route ID from a finding (based on evidence path and rule)
 */
function extractRouteId(finding: Finding): string | null {
  if (finding.evidence.length === 0) return null;
  const file = finding.evidence[0].file;
  // Extract method from title if present
  const methodMatch = finding.title.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/);
  const method = methodMatch ? methodMatch[1] : "UNKNOWN";
  return `${file}:${method}`;
}

/**
 * Get protection type from rule ID
 */
function getProtectionType(ruleId: string): ProtectionRegression["protectionType"] | null {
  for (const [prefix, type] of Object.entries(PROTECTION_RULE_MAPPING)) {
    if (ruleId.startsWith(prefix)) {
      return type;
    }
  }
  return null;
}

/**
 * Group findings by route for semantic analysis
 */
function groupByRoute(findings: Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const routeId = extractRouteId(finding);
    if (!routeId) continue;
    if (!groups.has(routeId)) {
      groups.set(routeId, []);
    }
    groups.get(routeId)!.push(finding);
  }
  return groups;
}

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

  // Detect semantic regressions
  const protectionRegressions = detectProtectionRegressions(current, baseline);
  const semanticRegressions = detectSemanticRegressions(current, baseline);

  return {
    baselineId: baseline.repo?.name ?? "unknown",
    baselineGeneratedAt: baseline.generatedAt,
    newFindings,
    resolvedFindings,
    persistingCount,
    severityRegressions,
    netChange,
    protectionRegressions: protectionRegressions.length > 0 ? protectionRegressions : undefined,
    semanticRegressions: semanticRegressions.length > 0 ? semanticRegressions : undefined,
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

/**
 * Detect protection regressions - routes that lost protection coverage
 *
 * A protection regression occurs when:
 * - Baseline had NO finding for a route (was protected)
 * - Current HAS a finding for that route (protection removed)
 */
export function detectProtectionRegressions(
  current: ScanArtifact,
  baseline: ScanArtifact
): ProtectionRegression[] {
  const regressions: ProtectionRegression[] = [];

  const baselineByRoute = groupByRoute(baseline.findings);
  const currentByRoute = groupByRoute(current.findings);

  // Look for routes that have NEW findings (protection was removed)
  for (const [routeId, currentFindings] of currentByRoute) {
    const baselineFindings = baselineByRoute.get(routeId) || [];

    // Check each current finding - if it's new, it might indicate protection removal
    for (const finding of currentFindings) {
      const protectionType = getProtectionType(finding.ruleId);
      if (!protectionType) continue;

      // Check if baseline had this specific type of protection finding
      const hadSimilarFinding = baselineFindings.some(
        (bf) => bf.ruleId === finding.ruleId || bf.fingerprint === finding.fingerprint
      );

      if (!hadSimilarFinding) {
        // This is a new protection-related finding - protection may have been removed
        const [file, method] = routeId.split(":");
        regressions.push({
          routeId,
          file,
          method,
          protectionType,
          description: `New ${protectionType} issue detected: ${finding.title}`,
          relatedFingerprints: [finding.fingerprint],
        });
      }
    }
  }

  return regressions;
}

/**
 * Detect semantic regressions - abstract security property degradations
 */
export function detectSemanticRegressions(
  current: ScanArtifact,
  baseline: ScanArtifact
): SemanticRegression[] {
  const regressions: SemanticRegression[] = [];

  // 1. Detect protection removal
  const protectionRegressions = detectProtectionRegressions(current, baseline);
  for (const pr of protectionRegressions) {
    regressions.push({
      type: "protection_removed",
      severity: "high",
      description: pr.description,
      affectedId: pr.routeId,
      details: { protectionType: pr.protectionType, file: pr.file, method: pr.method },
    });
  }

  // 2. Detect coverage decrease (more routes have findings now)
  const baselineRoutes = new Set(groupByRoute(baseline.findings).keys());
  const currentRoutes = new Set(groupByRoute(current.findings).keys());

  // Routes that are new in current (newly unprotected)
  const newlyUnprotectedRoutes: string[] = [];
  for (const route of currentRoutes) {
    if (!baselineRoutes.has(route)) {
      newlyUnprotectedRoutes.push(route);
    }
  }

  if (newlyUnprotectedRoutes.length > 0 && baseline.findings.length > 0) {
    // Only report coverage decrease if there's a significant change
    const coverageIncrease = newlyUnprotectedRoutes.length / Math.max(baselineRoutes.size, 1);
    if (coverageIncrease > 0.1) {  // More than 10% increase in affected routes
      regressions.push({
        type: "coverage_decreased",
        severity: "medium",
        description: `${newlyUnprotectedRoutes.length} new routes have security findings (coverage decreased)`,
        affectedId: "coverage",
        details: {
          previousRouteCount: baselineRoutes.size,
          currentRouteCount: currentRoutes.size,
          newlyAffectedRoutes: newlyUnprotectedRoutes.slice(0, 5), // Limit to 5 for readability
        },
      });
    }
  }

  // 3. Detect severity group increase (fingerprint groups with worse overall severity)
  const currentIndex = buildFingerprintIndex(current.findings);
  const baselineIndex = buildFingerprintIndex(baseline.findings);

  // Group by rule prefix for category-level analysis
  const baselineBySeverity = new Map<string, number>();
  const currentBySeverity = new Map<string, number>();

  for (const finding of baseline.findings) {
    const key = finding.ruleId.replace(/-\d+$/, ""); // e.g., VC-AUTH-001 -> VC-AUTH
    const current = baselineBySeverity.get(key) || 0;
    baselineBySeverity.set(key, Math.max(current, SEVERITY_ORDER[finding.severity]));
  }

  for (const finding of current.findings) {
    const key = finding.ruleId.replace(/-\d+$/, "");
    const curr = currentBySeverity.get(key) || 0;
    currentBySeverity.set(key, Math.max(curr, SEVERITY_ORDER[finding.severity]));
  }

  for (const [rulePrefix, currentMax] of currentBySeverity) {
    const baselineMax = baselineBySeverity.get(rulePrefix) || 0;
    if (currentMax > baselineMax && currentMax >= SEVERITY_ORDER.high) {
      const severityName = Object.entries(SEVERITY_ORDER).find(
        ([, v]) => v === currentMax
      )?.[0] as Severity;

      regressions.push({
        type: "severity_group_increase",
        severity: severityName,
        description: `${rulePrefix} findings have increased to ${severityName} severity`,
        affectedId: rulePrefix,
        details: {
          previousMaxSeverity: baselineMax,
          currentMaxSeverity: currentMax,
        },
      });
    }
  }

  return regressions;
}

/**
 * Check if regression has protection regressions
 */
export function hasProtectionRegressions(regression: RegressionSummary): boolean {
  return (regression.protectionRegressions?.length ?? 0) > 0;
}

/**
 * Check if regression has semantic regressions
 */
export function hasSemanticRegressions(regression: RegressionSummary): boolean {
  return (regression.semanticRegressions?.length ?? 0) > 0;
}

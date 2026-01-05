/**
 * What-If Policy Evaluator
 *
 * Evaluates artifacts against policy with What-If simulation overrides applied.
 * This wraps the core @vibecheck/policy evaluator and applies What-If changes.
 */

import type { ScanArtifact, Finding, Severity, Category } from "@vibecheck/schema";
import {
  evaluate,
  type PolicyReport,
  type ProfileName,
  type Waiver,
  type PolicyReason,
  type Override,
} from "@vibecheck/policy";
import {
  applyWhatIfOverrides,
  type WhatIfOverride,
  type WhatIfPathIgnore,
} from "./whatif-store";

// ============================================================================
// Types
// ============================================================================

export interface WhatIfEvaluateInput {
  artifact: ScanArtifact;
  baseline?: ScanArtifact;
  profile: ProfileName;
  waivers?: Waiver[];
  whatIfOverrides: WhatIfOverride[];
  whatIfPathIgnores: WhatIfPathIgnore[];
}

export interface WhatIfPolicyReport extends PolicyReport {
  whatIf: {
    isSimulation: true;
    ignoredByWhatIf: number;
    modifiedByWhatIf: number;
    originalStatus: PolicyReport["status"];
    originalReasons: PolicyReason[];
    changes: WhatIfChange[];
  };
}

export interface WhatIfChange {
  type: "ignored" | "severity_changed" | "path_ignored";
  findingId: string;
  fingerprint: string;
  ruleId: string;
  title: string;
  reason: string;
  originalSeverity?: Severity;
  newSeverity?: Severity;
  pathPattern?: string;
}

// ============================================================================
// Evaluator
// ============================================================================

/**
 * Evaluate artifact with What-If overrides applied
 */
export function evaluateWithWhatIf(input: WhatIfEvaluateInput): WhatIfPolicyReport {
  const { artifact, baseline, profile, waivers = [], whatIfOverrides, whatIfPathIgnores } = input;

  // First, evaluate without What-If to get original result
  const originalReport = evaluate({
    artifact,
    baseline,
    profile,
    waivers,
  });

  // If no What-If overrides, return original with What-If metadata
  if (whatIfOverrides.length === 0 && whatIfPathIgnores.length === 0) {
    return {
      ...originalReport,
      whatIf: {
        isSimulation: true,
        ignoredByWhatIf: 0,
        modifiedByWhatIf: 0,
        originalStatus: originalReport.status,
        originalReasons: [...originalReport.reasons],
        changes: [],
      },
    };
  }

  // Apply What-If overrides to findings
  const { activeFindings, ignoredFindings, modifiedFindings } = applyWhatIfOverrides(
    artifact.findings,
    whatIfOverrides,
    whatIfPathIgnores
  );

  // Create a modified artifact with the filtered/modified findings
  const modifiedArtifact: ScanArtifact = {
    ...artifact,
    findings: activeFindings,
  };

  // Evaluate the modified artifact
  const whatIfReport = evaluate({
    artifact: modifiedArtifact,
    baseline,
    profile,
    waivers,
  });

  // Build change log
  const changes: WhatIfChange[] = [];

  for (const { finding, override } of ignoredFindings) {
    if ("action" in override) {
      // WhatIfOverride
      changes.push({
        type: "ignored",
        findingId: finding.id,
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
        title: finding.title,
        reason: override.reason,
        originalSeverity: finding.severity,
      });
    } else {
      // WhatIfPathIgnore
      changes.push({
        type: "path_ignored",
        findingId: finding.id,
        fingerprint: finding.fingerprint,
        ruleId: finding.ruleId,
        title: finding.title,
        reason: override.reason,
        pathPattern: override.pathPattern,
        originalSeverity: finding.severity,
      });
    }
  }

  for (const { finding, override, originalSeverity } of modifiedFindings) {
    changes.push({
      type: "severity_changed",
      findingId: finding.id,
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      title: finding.title,
      reason: override.reason,
      originalSeverity,
      newSeverity: finding.severity,
    });
  }

  return {
    ...whatIfReport,
    whatIf: {
      isSimulation: true,
      ignoredByWhatIf: ignoredFindings.length,
      modifiedByWhatIf: modifiedFindings.length,
      originalStatus: originalReport.status,
      originalReasons: [...originalReport.reasons],
      changes,
    },
  };
}

/**
 * Compare two policy reports to determine what changed
 */
export interface PolicyDiff {
  statusChanged: boolean;
  originalStatus: PolicyReport["status"];
  newStatus: PolicyReport["status"];
  originalExitCode: number;
  newExitCode: number;
  findingsRemoved: number;
  severityChanges: number;
  reasonsChanged: boolean;
  wouldUnblock: boolean; // Would this change unblock a deploy?
}

export function comparePolicyReports(
  original: PolicyReport,
  simulation: WhatIfPolicyReport
): PolicyDiff {
  return {
    statusChanged: original.status !== simulation.status,
    originalStatus: original.status,
    newStatus: simulation.status,
    originalExitCode: original.exitCode,
    newExitCode: simulation.exitCode,
    findingsRemoved: simulation.whatIf.ignoredByWhatIf,
    severityChanges: simulation.whatIf.modifiedByWhatIf,
    reasonsChanged: JSON.stringify(original.reasons) !== JSON.stringify(simulation.reasons),
    wouldUnblock: original.status === "fail" && simulation.status !== "fail",
  };
}

/**
 * Get a human-readable summary of What-If changes
 */
export function getWhatIfSummary(report: WhatIfPolicyReport): string {
  const { whatIf } = report;

  if (whatIf.ignoredByWhatIf === 0 && whatIf.modifiedByWhatIf === 0) {
    return "No simulation changes applied";
  }

  const parts: string[] = [];

  if (whatIf.ignoredByWhatIf > 0) {
    parts.push(`${whatIf.ignoredByWhatIf} finding${whatIf.ignoredByWhatIf !== 1 ? "s" : ""} ignored`);
  }

  if (whatIf.modifiedByWhatIf > 0) {
    parts.push(`${whatIf.modifiedByWhatIf} finding${whatIf.modifiedByWhatIf !== 1 ? "s" : ""} downgraded`);
  }

  if (whatIf.originalStatus !== report.status) {
    parts.push(`status changed from ${whatIf.originalStatus.toUpperCase()} to ${report.status.toUpperCase()}`);
  }

  return parts.join(", ");
}

/**
 * Check if What-If simulation would unblock a failing policy
 */
export function wouldUnblockDeploy(report: WhatIfPolicyReport): boolean {
  return report.whatIf.originalStatus === "fail" && report.status !== "fail";
}

/**
 * Get the color for a status
 */
export function getStatusColor(status: PolicyReport["status"]): string {
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
 * Convert What-If overrides to policy overrides for export
 * (for users who want to make their simulation permanent)
 */
export function convertToOverrides(
  whatIfOverrides: WhatIfOverride[],
  whatIfPathIgnores: WhatIfPathIgnore[]
): Override[] {
  const overrides: Override[] = [];

  // Convert path ignores to policy overrides
  for (const pathIgnore of whatIfPathIgnores) {
    overrides.push({
      ruleId: pathIgnore.ruleId,
      pathPattern: pathIgnore.pathPattern,
      action: "ignore",
      comment: pathIgnore.reason,
    });
  }

  return overrides;
}

/**
 * Convert What-If waivers to actual waivers for export
 */
export function convertToWaivers(whatIfOverrides: WhatIfOverride[]): Waiver[] {
  return whatIfOverrides
    .filter((o) => o.action === "waive")
    .map((o) => ({
      id: `w-whatif-${o.findingId}`,
      match: {
        fingerprint: o.fingerprint,
      },
      reason: o.reason,
      createdBy: "what-if-simulation",
      createdAt: o.createdAt,
    }));
}

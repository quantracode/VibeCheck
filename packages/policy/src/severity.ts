import type { Severity } from "@vibecheck/schema";

/**
 * Severity ordering (higher = more severe)
 */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * All severity levels in order
 */
export const SEVERITY_LEVELS: Severity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

/**
 * Compare two severities
 * Returns positive if a is more severe than b
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}

/**
 * Check if severity a meets or exceeds threshold b
 */
export function severityMeetsThreshold(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

/**
 * Get the next lower severity
 */
export function lowerSeverity(severity: Severity): Severity {
  const index = SEVERITY_LEVELS.indexOf(severity);
  return index > 0 ? SEVERITY_LEVELS[index - 1] : severity;
}

/**
 * Get the next higher severity
 */
export function higherSeverity(severity: Severity): Severity {
  const index = SEVERITY_LEVELS.indexOf(severity);
  return index < SEVERITY_LEVELS.length - 1 ? SEVERITY_LEVELS[index + 1] : severity;
}

import type { Finding } from "@vibecheck/schema";

/**
 * Context passed to each scanner
 */
export interface ScanContext {
  /** Absolute path to the target directory being scanned */
  targetDir: string;
  /** List of source files found (relative paths) */
  sourceFiles: string[];
}

/**
 * Scanner function signature
 */
export type Scanner = (context: ScanContext) => Promise<Finding[]>;

/**
 * Severity levels for comparison
 */
export const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
} as const;

/**
 * Check if severity meets or exceeds threshold
 */
export function severityMeetsThreshold(
  severity: keyof typeof SEVERITY_ORDER,
  threshold: keyof typeof SEVERITY_ORDER
): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

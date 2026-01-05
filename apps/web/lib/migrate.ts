/**
 * Migration/compatibility layer for loading older artifact versions
 * Normalizes 0.1 and 0.2 artifacts to be compatible with 0.3 schema
 */

import type { ScanArtifact, CategoryCounts } from "@vibecheck/schema";

/**
 * Phase 4 categories that may be missing in older artifacts
 */
const PHASE4_CATEGORIES = [
  "correlation",
  "authorization",
  "lifecycle",
  "supply-chain",
] as const;

/**
 * All categories including Phase 4
 */
const ALL_CATEGORIES: (keyof CategoryCounts)[] = [
  "auth",
  "validation",
  "middleware",
  "secrets",
  "injection",
  "privacy",
  "config",
  "network",
  "crypto",
  "uploads",
  "hallucinations",
  "abuse",
  "correlation",
  "authorization",
  "lifecycle",
  "supply-chain",
  "other",
];

/**
 * Migrate an artifact from any supported version to be compatible with 0.3
 * Does NOT change artifactVersion - we preserve the original for tracking
 */
export function migrateArtifact(artifact: unknown): ScanArtifact {
  // Type guard for basic structure
  if (!artifact || typeof artifact !== "object") {
    throw new Error("Invalid artifact: not an object");
  }

  const a = artifact as Record<string, unknown>;

  // Check for required fields
  if (!a.artifactVersion || !a.summary || !a.findings) {
    throw new Error("Invalid artifact: missing required fields");
  }

  const version = a.artifactVersion as string;

  // Validate supported versions
  if (!["0.1", "0.2", "0.3"].includes(version)) {
    throw new Error(`Unsupported artifact version: ${version}`);
  }

  // Clone to avoid mutating the original
  const migrated = JSON.parse(JSON.stringify(artifact)) as ScanArtifact;

  // Migrate byCategory to include Phase 4 categories
  if (migrated.summary?.byCategory) {
    const byCategory = migrated.summary.byCategory as Record<string, number>;

    // Add missing Phase 4 categories with zero counts
    for (const cat of PHASE4_CATEGORIES) {
      if (!(cat in byCategory)) {
        byCategory[cat] = 0;
      }
    }

    // Ensure 'other' category exists
    if (!("other" in byCategory)) {
      byCategory["other"] = 0;
    }
  }

  // Ensure findings have the expected shape
  if (Array.isArray(migrated.findings)) {
    for (const finding of migrated.findings) {
      // relatedFindings is optional but may be missing in older versions
      if (!finding.relatedFindings) {
        finding.relatedFindings = undefined; // Explicitly undefined, not added
      }
    }
  }

  return migrated;
}

/**
 * Check if an artifact needs migration
 */
export function needsMigration(artifact: unknown): boolean {
  if (!artifact || typeof artifact !== "object") {
    return false;
  }

  const a = artifact as Record<string, unknown>;
  const version = a.artifactVersion as string;

  // Only 0.1 and 0.2 need migration
  return version === "0.1" || version === "0.2";
}

/**
 * Get the effective version after migration
 * Returns the original version - we don't change it
 */
export function getEffectiveVersion(artifact: ScanArtifact): string {
  return artifact.artifactVersion;
}

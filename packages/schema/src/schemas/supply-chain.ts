import { z } from "zod";

// ============================================================================
// Supply Chain Lite Schema (Phase 4)
// Local-only analysis of package.json and lockfiles - NO CVE feeds
// ============================================================================

/**
 * Risk indicators found in dependencies (no external API calls)
 */
export const DependencyRiskIndicatorSchema = z.enum([
  "unpinned_version",      // Uses ^ or ~ instead of exact version
  "git_dependency",        // Uses git:// or github: URL
  "postinstall_script",    // Has postinstall lifecycle hook
  "preinstall_script",     // Has preinstall lifecycle hook
  "file_dependency",       // Uses file: protocol
  "link_dependency",       // Uses link: protocol
  "deprecated_package",    // Package marked as deprecated in package.json
]);

/**
 * Individual dependency analysis
 */
export const DependencyInfoSchema = z.object({
  /** Package name */
  name: z.string(),
  /** Declared version or range */
  declaredVersion: z.string(),
  /** Resolved version from lockfile (if available) */
  resolvedVersion: z.string().optional(),
  /** Whether this is a devDependency */
  isDev: z.boolean(),
  /** Risk indicators found */
  riskIndicators: z.array(DependencyRiskIndicatorSchema),
  /** Has lifecycle scripts */
  hasLifecycleScripts: z.boolean(),
});

/**
 * Lockfile analysis results
 */
export const LockfileInfoSchema = z.object({
  /** Lockfile type detected */
  type: z.enum(["npm", "pnpm", "yarn", "yarn-berry", "bun", "none"]),
  /** Lockfile path relative to repo root */
  path: z.string().optional(),
  /** Whether lockfile exists */
  exists: z.boolean(),
  /** SHA-256 hash of lockfile content for integrity tracking */
  contentHash: z.string().optional(),
  /** Total number of resolved dependencies */
  totalDependencies: z.number().int().nonnegative().optional(),
});

/**
 * Package.json analysis results
 */
export const PackageJsonInfoSchema = z.object({
  /** Path relative to repo root */
  path: z.string(),
  /** Package name */
  name: z.string().optional(),
  /** Package version */
  version: z.string().optional(),
  /** Number of production dependencies */
  dependencyCount: z.number().int().nonnegative(),
  /** Number of dev dependencies */
  devDependencyCount: z.number().int().nonnegative(),
  /** Whether engines field is specified */
  hasEngines: z.boolean(),
  /** Whether package-lock is disabled */
  packageLockDisabled: z.boolean(),
});

/**
 * Complete supply chain analysis for the artifact
 */
export const SupplyChainInfoSchema = z.object({
  /** Analysis timestamp */
  analyzedAt: z.string().datetime(),
  /** Package.json info */
  packageJson: PackageJsonInfoSchema,
  /** Lockfile info */
  lockfile: LockfileInfoSchema,
  /** Dependencies with risk indicators (limited to those with issues) */
  riskyDependencies: z.array(DependencyInfoSchema),
  /** Summary counts */
  summary: z.object({
    totalDependencies: z.number().int().nonnegative(),
    unpinnedCount: z.number().int().nonnegative(),
    gitDependencyCount: z.number().int().nonnegative(),
    lifecycleScriptCount: z.number().int().nonnegative(),
  }),
});

// Type exports
export type DependencyRiskIndicator = z.infer<typeof DependencyRiskIndicatorSchema>;
export type DependencyInfo = z.infer<typeof DependencyInfoSchema>;
export type LockfileInfo = z.infer<typeof LockfileInfoSchema>;
export type PackageJsonInfo = z.infer<typeof PackageJsonInfoSchema>;
export type SupplyChainInfo = z.infer<typeof SupplyChainInfoSchema>;

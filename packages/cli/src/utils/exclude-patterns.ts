/**
 * Default exclude patterns for file scanning
 *
 * These patterns are applied by default to exclude common
 * non-source directories and test files.
 */

/**
 * Core excludes that are always applied (build artifacts, dependencies, etc.)
 */
export const CORE_EXCLUDES: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/out/**",
  "**/.vercel/**",
  "**/.netlify/**",
];

/**
 * Test-related excludes (can be disabled with --include-tests)
 */
export const TEST_EXCLUDES: string[] = [
  "**/__tests__/**",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/test/**",
  "**/tests/**",
  "**/fixtures/**",
  "**/__mocks__/**",
  "**/__fixtures__/**",
  "**/cypress/**",
  "**/e2e/**",
  "**/*.stories.ts",
  "**/*.stories.tsx",
  "**/*.stories.js",
  "**/*.stories.jsx",
];

/**
 * Get default exclude patterns based on options
 */
export function getDefaultExcludes(options: { includeTests?: boolean } = {}): string[] {
  const excludes = [...CORE_EXCLUDES];

  if (!options.includeTests) {
    excludes.push(...TEST_EXCLUDES);
  }

  return excludes;
}

/**
 * Merge custom excludes with defaults
 */
export function mergeExcludes(
  customExcludes: string[],
  options: { includeTests?: boolean } = {}
): string[] {
  const defaults = getDefaultExcludes(options);
  const merged = new Set([...defaults, ...customExcludes]);
  return Array.from(merged);
}

/**
 * Normalize glob pattern for cross-platform compatibility
 */
export function normalizeGlobPattern(pattern: string): string {
  // Ensure forward slashes for glob patterns
  return pattern.replace(/\\/g, "/");
}

/**
 * Normalize a list of patterns
 */
export function normalizePatterns(patterns: string[]): string[] {
  return patterns.map(normalizeGlobPattern);
}

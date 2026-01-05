import { readFileSync, fileExists, resolvePath } from "../../utils/file-utils.js";
import * as YAML from "yaml";

/**
 * Package information from lockfile
 */
export interface LockfilePackage {
  name: string;
  version: string;
  /** Install scripts if available */
  scripts?: {
    preinstall?: string;
    install?: string;
    postinstall?: string;
    prepare?: string;
  };
  /** Dependencies of this package */
  dependencies?: Record<string, string>;
  /** Whether package has install scripts */
  hasInstallScripts?: boolean;
}

/**
 * Parsed lockfile information
 */
export interface ParsedLockfile {
  /** Lockfile type */
  type: "pnpm" | "yarn" | "npm" | "none";
  /** Lockfile path */
  path: string | null;
  /** All packages in the lockfile */
  packages: Map<string, LockfilePackage>;
  /** Direct dependencies (from package.json) */
  directDependencies: Set<string>;
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Read and parse package.json
 */
export function parsePackageJson(repoRoot: string): PackageJson | null {
  const pkgPath = resolvePath(repoRoot, "package.json");
  const content = readFileSync(pkgPath);
  if (!content) return null;

  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Parse pnpm-lock.yaml
 */
function parsePnpmLock(content: string): Map<string, LockfilePackage> {
  const packages = new Map<string, LockfilePackage>();

  try {
    const parsed = YAML.parse(content);

    // pnpm v6+ format uses "packages" key
    const pkgs = parsed.packages || {};

    for (const [key, value] of Object.entries(pkgs)) {
      if (!value || typeof value !== "object") continue;

      const pkgData = value as Record<string, unknown>;

      // Extract package name from key (e.g., "/lodash@4.17.21" or "lodash@4.17.21")
      const match = key.match(/^\/?(@?[^@]+)@(.+)$/);
      if (!match) continue;

      const [, name, version] = match;

      packages.set(name, {
        name,
        version,
        hasInstallScripts: Boolean(pkgData.hasInstallScript || pkgData.requiresBuild),
        dependencies: pkgData.dependencies as Record<string, string> | undefined,
      });
    }
  } catch {
    // Failed to parse
  }

  return packages;
}

/**
 * Parse yarn.lock (v1 format)
 */
function parseYarnLock(content: string): Map<string, LockfilePackage> {
  const packages = new Map<string, LockfilePackage>();

  try {
    // Simple yarn.lock v1 parser
    // Format: "package@version:" followed by indented properties
    const entries = content.split(/\n(?=[@\w"])/);

    for (const entry of entries) {
      if (!entry.trim()) continue;

      // Match package name and versions
      const headerMatch = entry.match(/^"?(@?[^@\s"]+)@[^":\n]+/);
      if (!headerMatch) continue;

      const name = headerMatch[1];

      // Extract version
      const versionMatch = entry.match(/\n\s+version\s+"([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : "unknown";

      // Check for scripts (yarn.lock v1 doesn't include scripts directly)
      packages.set(name, {
        name,
        version,
        hasInstallScripts: false, // yarn.lock v1 doesn't include this
      });
    }
  } catch {
    // Failed to parse
  }

  return packages;
}

/**
 * Parse package-lock.json
 */
function parseNpmLock(content: string): Map<string, LockfilePackage> {
  const packages = new Map<string, LockfilePackage>();

  try {
    const parsed = JSON.parse(content);

    // npm v7+ uses "packages" key, v6 uses "dependencies"
    const pkgs = parsed.packages || {};
    const deps = parsed.dependencies || {};

    // Process v7+ format
    for (const [key, value] of Object.entries(pkgs)) {
      if (!key || key === "") continue; // Skip root
      if (!value || typeof value !== "object") continue;

      const pkgData = value as Record<string, unknown>;

      // Extract name from path (e.g., "node_modules/lodash")
      const name = key.replace(/^node_modules\//, "").replace(/^.*node_modules\//, "");
      if (!name) continue;

      packages.set(name, {
        name,
        version: (pkgData.version as string) || "unknown",
        hasInstallScripts: Boolean(pkgData.hasInstallScript),
        scripts: pkgData.scripts as LockfilePackage["scripts"],
      });
    }

    // Process v6 format
    for (const [name, value] of Object.entries(deps)) {
      if (!value || typeof value !== "object") continue;
      if (packages.has(name)) continue; // Don't override v7 data

      const pkgData = value as Record<string, unknown>;

      packages.set(name, {
        name,
        version: (pkgData.version as string) || "unknown",
        hasInstallScripts: Boolean(pkgData.hasInstallScript),
      });
    }
  } catch {
    // Failed to parse
  }

  return packages;
}

/**
 * Detect and parse the lockfile for a repository
 */
export function parseLockfile(repoRoot: string): ParsedLockfile {
  // Get direct dependencies from package.json
  const pkg = parsePackageJson(repoRoot);
  const directDependencies = new Set<string>();

  if (pkg) {
    for (const name of Object.keys(pkg.dependencies || {})) {
      directDependencies.add(name);
    }
    for (const name of Object.keys(pkg.devDependencies || {})) {
      directDependencies.add(name);
    }
  }

  // Try pnpm-lock.yaml first
  const pnpmPath = resolvePath(repoRoot, "pnpm-lock.yaml");
  if (fileExists(pnpmPath)) {
    const content = readFileSync(pnpmPath);
    if (content) {
      return {
        type: "pnpm",
        path: pnpmPath,
        packages: parsePnpmLock(content),
        directDependencies,
      };
    }
  }

  // Try yarn.lock
  const yarnPath = resolvePath(repoRoot, "yarn.lock");
  if (fileExists(yarnPath)) {
    const content = readFileSync(yarnPath);
    if (content) {
      return {
        type: "yarn",
        path: yarnPath,
        packages: parseYarnLock(content),
        directDependencies,
      };
    }
  }

  // Try package-lock.json
  const npmPath = resolvePath(repoRoot, "package-lock.json");
  if (fileExists(npmPath)) {
    const content = readFileSync(npmPath);
    if (content) {
      return {
        type: "npm",
        path: npmPath,
        packages: parseNpmLock(content),
        directDependencies,
      };
    }
  }

  return {
    type: "none",
    path: null,
    packages: new Map(),
    directDependencies,
  };
}

/**
 * Check if a version string is a range (not pinned)
 */
export function isVersionRange(version: string): boolean {
  // Pinned versions: exact semver (1.2.3) or URLs
  // Ranges: ^, ~, >, <, >=, <=, ||, *, x, workspace:, etc.

  // Workspace protocol - consider as pinned for supply chain purposes
  if (version.startsWith("workspace:")) return false;

  // File/git/URL references - consider as pinned
  if (version.startsWith("file:") || version.startsWith("git") || version.includes("://")) {
    return false;
  }

  // Range indicators
  const rangeIndicators = /[\^~><*x|]|\s-\s/;
  return rangeIndicators.test(version);
}

/**
 * Get version range type description
 */
export function getVersionRangeType(version: string): string {
  if (version.startsWith("^")) return "caret (^) - allows minor updates";
  if (version.startsWith("~")) return "tilde (~) - allows patch updates";
  if (version.includes("||")) return "OR range - multiple versions";
  if (version === "*" || version === "x") return "wildcard - any version";
  if (version.includes(">") || version.includes("<")) return "comparison range";
  return "range";
}

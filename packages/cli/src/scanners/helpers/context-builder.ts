import { findFiles, readJsonSync, resolvePath, fileExists, readFileSync } from "../../utils/file-utils.js";
import { createAstHelpers } from "./ast-helpers.js";
import { getDefaultExcludes, mergeExcludes, normalizePatterns } from "../../utils/exclude-patterns.js";
import type { ScanContext, FileIndex, RepoMeta, FrameworkHints, PrismaSchemaInfo, PrismaModelInfo, FileProgressCallback } from "../types.js";

/**
 * Options for building scan context
 */
export interface ScanContextOptions {
  /** Additional glob patterns to exclude */
  excludePatterns?: string[];
  /** Include test files in scan */
  includeTests?: boolean;
  /** Progress callback for file processing */
  onFileProgress?: FileProgressCallback;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/**
 * Detect framework from package.json dependencies
 */
function detectFramework(deps: Record<string, string>, devDeps: Record<string, string>): RepoMeta["framework"] {
  const allDeps = { ...deps, ...devDeps };

  if (allDeps["next"]) return "next";
  if (allDeps["express"]) return "express";
  if (allDeps["fastify"]) return "fastify";
  if (allDeps["koa"]) return "koa";

  return "unknown";
}

/**
 * Build file index for quick lookups
 */
async function buildFileIndex(
  repoRoot: string,
  options: ScanContextOptions = {}
): Promise<FileIndex> {
  // Build exclude patterns from defaults + custom
  const customExcludes = options.excludePatterns ?? [];
  const ignorePatterns = normalizePatterns(
    mergeExcludes(customExcludes, { includeTests: options.includeTests })
  );

  // Find all source files
  const allSourceFiles = await findFiles(
    ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    { cwd: repoRoot, ignore: ignorePatterns }
  );

  // TypeScript files only
  const tsTsxFiles = allSourceFiles.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

  // Config files
  const configFiles = await findFiles(
    [".env*", "**/*.config.*", "**/config.*"],
    { cwd: repoRoot, ignore: ignorePatterns }
  );

  // Next.js route files (App Router)
  const routeFiles = await findFiles(
    ["**/route.ts", "**/route.js", "src/**/route.ts", "src/**/route.js"],
    { cwd: repoRoot, ignore: ignorePatterns }
  );

  // API route files specifically
  const apiRouteFiles = routeFiles.filter(
    (f) => f.includes("/api/") || f.includes("\\api\\")
  );

  // Find middleware file
  let middlewareFile: string | undefined;
  const middlewareCandidates = [
    "middleware.ts",
    "middleware.js",
    "src/middleware.ts",
    "src/middleware.js",
  ];
  for (const candidate of middlewareCandidates) {
    if (fileExists(resolvePath(repoRoot, candidate))) {
      middlewareFile = candidate;
      break;
    }
  }

  return {
    allSourceFiles,
    tsTsxFiles,
    configFiles,
    routeFiles,
    middlewareFile,
    apiRouteFiles,
  };
}

/**
 * Build repository metadata from package.json
 */
function buildRepoMeta(repoRoot: string): RepoMeta {
  const pkgPath = resolvePath(repoRoot, "package.json");
  const pkg = readJsonSync<PackageJson>(pkgPath);

  const dependencies = pkg?.dependencies ?? {};
  const devDependencies = pkg?.devDependencies ?? {};
  const allDeps = { ...dependencies, ...devDependencies };

  return {
    dependencies,
    devDependencies,
    framework: detectFramework(dependencies, devDependencies),
    hasTypeScript: Boolean(allDeps["typescript"]),
    hasNextAuth: Boolean(allDeps["next-auth"]),
    hasPrisma: Boolean(allDeps["prisma"] || allDeps["@prisma/client"]),
  };
}

/**
 * Build framework hints from dependencies
 */
function buildFrameworkHints(repoRoot: string, deps: Record<string, string>, devDeps: Record<string, string>): FrameworkHints {
  const allDeps = { ...deps, ...devDeps };

  return {
    isNext: Boolean(allDeps["next"]),
    isExpress: Boolean(allDeps["express"]),
    hasPrisma: Boolean(allDeps["prisma"] || allDeps["@prisma/client"]),
    hasNextAuth: Boolean(allDeps["next-auth"]),
    hasMulter: Boolean(allDeps["multer"]),
    hasFormidable: Boolean(allDeps["formidable"]),
  };
}

/**
 * Parse Prisma schema file if it exists
 */
function parsePrismaSchema(repoRoot: string): PrismaSchemaInfo | undefined {
  const schemaPath = resolvePath(repoRoot, "prisma/schema.prisma");
  const content = readFileSync(schemaPath);

  if (!content) return undefined;

  const models = new Map<string, PrismaModelInfo>();
  const sensitiveFieldPatterns = /password|hash|token|secret|apikey|api_key|private_key|credential/i;

  // Parse model blocks
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const modelBody = match[2];

    // Extract field names (first word on each non-empty line)
    const fields: string[] = [];
    const lines = modelBody.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

      const fieldMatch = trimmed.match(/^(\w+)\s+/);
      if (fieldMatch) {
        fields.push(fieldMatch[1]);
      }
    }

    const hasSensitiveFields = fields.some((f) => sensitiveFieldPatterns.test(f));

    models.set(modelName.toLowerCase(), {
      name: modelName,
      fields,
      hasSensitiveFields,
    });
  }

  return { models };
}

/**
 * Build a complete ScanContext for scanner use
 */
export async function buildScanContext(
  repoRoot: string,
  options: ScanContextOptions = {}
): Promise<ScanContext> {
  const [fileIndex, repoMeta] = await Promise.all([
    buildFileIndex(repoRoot, options),
    Promise.resolve(buildRepoMeta(repoRoot)),
  ]);

  const helpers = createAstHelpers(repoRoot, fileIndex.allSourceFiles.length, options.onFileProgress);
  const frameworkHints = buildFrameworkHints(repoRoot, repoMeta.dependencies, repoMeta.devDependencies);
  const prismaSchemaInfo = parsePrismaSchema(repoRoot);

  return {
    repoRoot,
    fileIndex,
    repoMeta,
    helpers,
    frameworkHints,
    prismaSchemaInfo,
    onFileProgress: options.onFileProgress,
  };
}

/**
 * Phase 3: Cross-file Proof Trace Builder
 *
 * Lightweight call-graph tracing for Next.js App Router.
 * Traces auth/validation through local imports (max depth 2).
 * Deterministic, local-only.
 */

import crypto from "node:crypto";
import path from "node:path";
import { type SourceFile, type Node, SyntaxKind } from "ts-morph";
import type {
  ScanContext,
  RouteInfo,
  MiddlewareInfo,
  ProofTrace,
  ProofTraceStep,
  FunctionNode,
  CoverageMetrics,
} from "../scanners/types.js";

const MAX_TRACE_DEPTH = 2;

/**
 * Generate a stable route ID from path, method, and file
 */
export function generateRouteId(
  routePath: string,
  method: string,
  file: string
): string {
  const normalized = `${method}:${routePath}:${file}`.toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

/**
 * Convert file path to URL path for Next.js App Router
 * e.g., "app/api/users/[id]/route.ts" -> "/api/users/[id]"
 */
export function filePathToRoutePath(filePath: string): string {
  // Normalize to forward slashes
  const normalized = filePath.replace(/\\/g, "/");

  // Find app directory
  const appIndex = normalized.indexOf("/app/");
  if (appIndex === -1) {
    // Try without leading slash
    const appIndexAlt = normalized.indexOf("app/");
    if (appIndexAlt === 0) {
      return extractRoutePath(normalized.slice(4));
    }
    return "/";
  }

  return extractRoutePath(normalized.slice(appIndex + 5));
}

function extractRoutePath(routePart: string): string {
  // Remove route.ts/route.js suffix
  const withoutRoute = routePart.replace(/\/route\.(ts|tsx|js|jsx)$/, "");

  // Handle root API route
  if (withoutRoute === "" || withoutRoute === "api") {
    return withoutRoute === "" ? "/" : "/api";
  }

  return "/" + withoutRoute;
}

/**
 * Build route map from scan context
 */
export function buildRouteMap(ctx: ScanContext): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const routeFile of ctx.fileIndex.routeFiles) {
    // routeFiles are relative paths, need to resolve to absolute for parseFile
    const absolutePath = path.join(ctx.repoRoot, routeFile);
    const sourceFile = ctx.helpers.parseFile(absolutePath);
    if (!sourceFile) continue;

    const handlers = ctx.helpers.findRouteHandlers(sourceFile);
    // routeFile is already relative to repoRoot, just normalize slashes
    const relPath = routeFile.replace(/\\/g, "/");
    const routePath = filePathToRoutePath(relPath);

    for (const handler of handlers) {
      const routeId = generateRouteId(routePath, handler.method, relPath);
      routes.push({
        routeId,
        method: handler.method,
        path: routePath,
        file: relPath,
        startLine: handler.startLine,
        endLine: handler.endLine,
      });
    }
  }

  return routes;
}

/**
 * Build middleware map from scan context
 */
export function buildMiddlewareMap(ctx: ScanContext): MiddlewareInfo[] {
  const middlewareList: MiddlewareInfo[] = [];

  if (!ctx.fileIndex.middlewareFile) {
    return middlewareList;
  }

  // middlewareFile is a relative path, resolve to absolute for parseFile
  const absolutePath = path.join(ctx.repoRoot, ctx.fileIndex.middlewareFile);
  const sourceFile = ctx.helpers.parseFile(absolutePath);
  if (!sourceFile) return middlewareList;

  // middlewareFile is already relative, just normalize slashes
  const relPath = ctx.fileIndex.middlewareFile.replace(/\\/g, "/");

  // Find config.matcher export
  const matchers = extractMiddlewareMatchers(sourceFile);
  const protectsApi = matchers.some(
    (m) => m.includes("/api") || m.includes("/(api)") || m === "/(.*)"
  );

  // Find the config declaration line
  let startLine = 1;
  sourceFile.forEachDescendant((node) => {
    if (
      node.getKind() === SyntaxKind.VariableDeclaration &&
      node.getText().includes("config")
    ) {
      startLine = node.getStartLineNumber();
    }
  });

  middlewareList.push({
    file: relPath,
    matchers,
    protectsApi,
    startLine,
  });

  return middlewareList;
}

/**
 * Extract matcher patterns from middleware config
 */
function extractMiddlewareMatchers(sourceFile: SourceFile): string[] {
  const matchers: string[] = [];

  sourceFile.forEachDescendant((node) => {
    // Look for config = { matcher: [...] }
    if (node.getKind() === SyntaxKind.PropertyAssignment) {
      const text = node.getText();
      if (text.startsWith("matcher")) {
        // Extract string literals from matcher array
        node.forEachDescendant((child) => {
          if (child.getKind() === SyntaxKind.StringLiteral) {
            const value = child.getText().replace(/['"]/g, "");
            matchers.push(value);
          }
        });
      }
    }
  });

  return matchers;
}

/**
 * Check if a route path is covered by middleware matchers
 */
export function isRouteCoveredByMiddleware(
  routePath: string,
  matchers: string[]
): boolean {
  for (const matcher of matchers) {
    // Convert Next.js matcher pattern to regex
    const pattern = matcher
      .replace(/\*/g, ".*")
      .replace(/\/:path\*/g, "/.*")
      .replace(/\(([^)]+)\)/g, "(?:$1)");

    try {
      const regex = new RegExp(`^${pattern}`);
      if (regex.test(routePath)) {
        return true;
      }
    } catch {
      // Invalid regex, try simple prefix match
      if (routePath.startsWith(matcher.replace(/\/:path\*$/, ""))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Trace auth/validation through a handler and its imports
 */
export function buildProofTrace(
  ctx: ScanContext,
  route: RouteInfo
): ProofTrace {
  const steps: ProofTraceStep[] = [];
  let authProven = false;
  let validationProven = false;

  const sourceFile = ctx.helpers.parseFile(
    path.join(ctx.repoRoot, route.file)
  );
  if (!sourceFile) {
    return {
      routeId: route.routeId,
      authProven: false,
      validationProven: false,
      middlewareCovered: false,
      steps: [],
    };
  }

  // Find the handler function
  const handlers = ctx.helpers.findRouteHandlers(sourceFile);
  const handler = handlers.find((h) => h.method === route.method);

  if (!handler) {
    return {
      routeId: route.routeId,
      authProven: false,
      validationProven: false,
      middlewareCovered: false,
      steps: [],
    };
  }

  // Check handler directly for auth
  if (ctx.helpers.containsAuthCheck(handler.functionNode)) {
    authProven = true;
    steps.push({
      file: route.file,
      line: handler.startLine,
      snippet: truncateSnippet(handler.functionNode.getText(), 100),
      label: "Auth check found in handler",
    });
  }

  // Check handler directly for validation
  const validationUsage = ctx.helpers.findValidationUsage(handler.functionNode);
  if (validationUsage.length > 0 && validationUsage.some((v) => v.resultUsed)) {
    validationProven = true;
    steps.push({
      file: route.file,
      line: validationUsage[0].line,
      snippet: truncateSnippet(ctx.helpers.getNodeText(validationUsage[0].node), 100),
      label: "Validation found in handler",
    });
  }

  // If not proven yet, trace through imports (max depth 2)
  if (!authProven || !validationProven) {
    const importedModules = getLocalImports(sourceFile, ctx.repoRoot, route.file);

    for (const importInfo of importedModules) {
      if (authProven && validationProven) break;

      const traceResult = traceImportedModule(
        ctx,
        importInfo,
        1, // depth
        !authProven,
        !validationProven
      );

      if (traceResult.authProven && !authProven) {
        authProven = true;
        steps.push(...traceResult.steps.filter((s) => s.label.includes("Auth")));
      }

      if (traceResult.validationProven && !validationProven) {
        validationProven = true;
        steps.push(...traceResult.steps.filter((s) => s.label.includes("Validation")));
      }
    }
  }

  // Check middleware coverage
  const middlewareMap = buildMiddlewareMap(ctx);
  const allMatchers = middlewareMap.flatMap((m) => m.matchers);
  const middlewareCovered = isRouteCoveredByMiddleware(route.path, allMatchers);

  if (middlewareCovered) {
    const middleware = middlewareMap[0];
    if (middleware) {
      steps.push({
        file: middleware.file,
        line: middleware.startLine,
        snippet: `matcher: ${JSON.stringify(middleware.matchers)}`,
        label: "Covered by middleware",
      });
    }
  }

  return {
    routeId: route.routeId,
    authProven,
    validationProven,
    middlewareCovered,
    steps,
  };
}

interface ImportInfo {
  modulePath: string;
  absolutePath: string;
  importedNames: string[];
}

/**
 * Get local (relative) imports from a source file
 */
function getLocalImports(
  sourceFile: SourceFile,
  repoRoot: string,
  currentFile: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const currentDir = path.dirname(path.join(repoRoot, currentFile));

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();

    // Only process relative imports
    if (!moduleSpecifier.startsWith(".")) {
      continue;
    }

    // Resolve to absolute path
    let absolutePath = path.resolve(currentDir, moduleSpecifier);

    // Try common extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    let resolved = false;

    for (const ext of extensions) {
      const withExt = absolutePath + ext;
      try {
        // Check if file exists by trying to parse it
        if (sourceFile.getProject().getSourceFile(withExt)) {
          absolutePath = withExt;
          resolved = true;
          break;
        }
      } catch {
        // File doesn't exist
      }
    }

    // Also try index files
    if (!resolved) {
      for (const ext of extensions) {
        const indexPath = path.join(absolutePath, `index${ext}`);
        try {
          if (sourceFile.getProject().getSourceFile(indexPath)) {
            absolutePath = indexPath;
            resolved = true;
            break;
          }
        } catch {
          // File doesn't exist
        }
      }
    }

    const importedNames: string[] = [];

    // Get named imports
    for (const namedImport of importDecl.getNamedImports()) {
      importedNames.push(namedImport.getName());
    }

    // Get default import
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      importedNames.push(defaultImport.getText());
    }

    imports.push({
      modulePath: moduleSpecifier,
      absolutePath,
      importedNames,
    });
  }

  return imports;
}

interface TraceResult {
  authProven: boolean;
  validationProven: boolean;
  steps: ProofTraceStep[];
}

/**
 * Trace an imported module for auth/validation
 */
function traceImportedModule(
  ctx: ScanContext,
  importInfo: ImportInfo,
  depth: number,
  needAuth: boolean,
  needValidation: boolean
): TraceResult {
  const result: TraceResult = {
    authProven: false,
    validationProven: false,
    steps: [],
  };

  if (depth > MAX_TRACE_DEPTH) {
    return result;
  }

  const sourceFile = ctx.helpers.parseFile(importInfo.absolutePath);
  if (!sourceFile) {
    return result;
  }

  const relPath = path.relative(ctx.repoRoot, importInfo.absolutePath).replace(/\\/g, "/");

  // Look for auth patterns in exported functions
  if (needAuth) {
    sourceFile.forEachDescendant((node) => {
      if (result.authProven) return;

      // Check function declarations
      if (
        node.getKind() === SyntaxKind.FunctionDeclaration ||
        node.getKind() === SyntaxKind.ArrowFunction
      ) {
        const funcNode = node as FunctionNode;
        if (ctx.helpers.containsAuthCheck(funcNode)) {
          result.authProven = true;
          result.steps.push({
            file: relPath,
            line: node.getStartLineNumber(),
            snippet: truncateSnippet(node.getText(), 100),
            label: `Auth check found in imported module (depth ${depth})`,
          });
        }
      }
    });
  }

  // Look for validation patterns
  if (needValidation) {
    sourceFile.forEachDescendant((node) => {
      if (result.validationProven) return;

      if (
        node.getKind() === SyntaxKind.FunctionDeclaration ||
        node.getKind() === SyntaxKind.ArrowFunction
      ) {
        const funcNode = node as FunctionNode;
        const validation = ctx.helpers.findValidationUsage(funcNode);
        if (validation.length > 0 && validation.some((v) => v.resultUsed)) {
          result.validationProven = true;
          result.steps.push({
            file: relPath,
            line: validation[0].line,
            snippet: truncateSnippet(ctx.helpers.getNodeText(validation[0].node), 100),
            label: `Validation found in imported module (depth ${depth})`,
          });
        }
      }
    });
  }

  // Recurse into this module's imports if still needed
  if ((!result.authProven && needAuth) || (!result.validationProven && needValidation)) {
    const nestedImports = getLocalImports(sourceFile, ctx.repoRoot, relPath);
    for (const nested of nestedImports) {
      const nestedResult = traceImportedModule(
        ctx,
        nested,
        depth + 1,
        needAuth && !result.authProven,
        needValidation && !result.validationProven
      );

      if (nestedResult.authProven) {
        result.authProven = true;
        result.steps.push(...nestedResult.steps);
      }

      if (nestedResult.validationProven) {
        result.validationProven = true;
        result.steps.push(...nestedResult.steps);
      }
    }
  }

  return result;
}

/**
 * Truncate a code snippet to max length
 */
function truncateSnippet(text: string, maxLength: number): string {
  // Remove excessive whitespace
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength - 3) + "...";
}

/**
 * Calculate coverage metrics from routes and proof traces
 */
export function calculateCoverage(
  routes: RouteInfo[],
  proofTraces: Map<string, ProofTrace>,
  middlewareMap: MiddlewareInfo[]
): CoverageMetrics {
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  const stateChangingRoutes = routes.filter((r) =>
    stateChangingMethods.includes(r.method)
  );

  // Auth coverage: state-changing routes with auth proven
  const authCoveredCount = stateChangingRoutes.filter((r) => {
    const trace = proofTraces.get(r.routeId);
    return trace?.authProven || trace?.middlewareCovered;
  }).length;

  const authCoverage =
    stateChangingRoutes.length > 0
      ? authCoveredCount / stateChangingRoutes.length
      : 1;

  // Validation coverage: POST/PUT/PATCH routes with validation proven
  const bodyRoutes = routes.filter((r) =>
    ["POST", "PUT", "PATCH"].includes(r.method)
  );
  const validationCoveredCount = bodyRoutes.filter((r) => {
    const trace = proofTraces.get(r.routeId);
    return trace?.validationProven;
  }).length;

  const validationCoverage =
    bodyRoutes.length > 0 ? validationCoveredCount / bodyRoutes.length : 1;

  // Middleware coverage: all routes covered by middleware
  const allMatchers = middlewareMap.flatMap((m) => m.matchers);
  const middlewareCoveredCount = routes.filter((r) =>
    isRouteCoveredByMiddleware(r.path, allMatchers)
  ).length;

  const middlewareCoverage =
    routes.length > 0 ? middlewareCoveredCount / routes.length : 1;

  return {
    authCoverage: Math.round(authCoverage * 100) / 100,
    validationCoverage: Math.round(validationCoverage * 100) / 100,
    middlewareCoverage: Math.round(middlewareCoverage * 100) / 100,
  };
}

/**
 * Build all proof traces for a scan context
 */
export function buildAllProofTraces(
  ctx: ScanContext,
  routes: RouteInfo[]
): Map<string, ProofTrace> {
  const traces = new Map<string, ProofTrace>();

  for (const route of routes) {
    const trace = buildProofTrace(ctx, route);
    traces.set(route.routeId, trace);
  }

  return traces;
}

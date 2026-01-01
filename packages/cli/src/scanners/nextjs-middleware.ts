import type { Finding, EvidenceItem } from "@vibecheck/schema";
import {
  readFileSync,
  fileExists,
  resolvePath,
  readJsonSync,
  findFiles,
} from "../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../utils/fingerprint.js";
import type { ScanContext } from "./types.js";

const RULE_MW_001 = "VC-MW-001";
const RULE_AUTH_INFO_001 = "VC-AUTH-INFO-001";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Check if project has next-auth dependency
 */
function hasNextAuth(targetDir: string): boolean {
  const pkgPath = resolvePath(targetDir, "package.json");
  const pkg = readJsonSync<PackageJson>(pkgPath);
  if (!pkg) return false;

  return Boolean(
    pkg.dependencies?.["next-auth"] || pkg.devDependencies?.["next-auth"]
  );
}

/**
 * Check if project is a Next.js project
 */
function isNextProject(targetDir: string): boolean {
  const pkgPath = resolvePath(targetDir, "package.json");
  const pkg = readJsonSync<PackageJson>(pkgPath);
  if (!pkg) return false;

  return Boolean(pkg.dependencies?.["next"] || pkg.devDependencies?.["next"]);
}

/**
 * Find middleware file in Next.js project
 * Can be at root or in src directory
 */
function findMiddlewarePath(targetDir: string): string | null {
  const candidates = [
    "middleware.ts",
    "middleware.js",
    "src/middleware.ts",
    "src/middleware.js",
  ];

  for (const candidate of candidates) {
    const fullPath = resolvePath(targetDir, candidate);
    if (fileExists(fullPath)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse matcher config from middleware file
 *
 * Looks for patterns like:
 * - export const config = { matcher: '/api/:path*' }
 * - export const config = { matcher: ['/api/:path*', '/admin/:path*'] }
 *
 * Limitations:
 * - Uses regex, may have false positives/negatives
 * - Does not handle dynamic matcher generation
 * - Does not parse complex expressions
 */
export function parseMatcherConfig(content: string): string[] | null {
  // Look for config export with matcher
  const configMatch = content.match(
    /export\s+const\s+config\s*=\s*\{[^}]*matcher\s*:\s*([^}]+)\}/s
  );

  if (!configMatch) {
    return null; // No config export found
  }

  const matcherPart = configMatch[1];

  // Check for array matcher: ['/path1', '/path2']
  const arrayMatch = matcherPart.match(/\[([^\]]+)\]/);
  if (arrayMatch) {
    const items = arrayMatch[1];
    const paths: string[] = [];

    // Extract string literals
    const stringMatches = items.matchAll(/['"]([^'"]+)['"]/g);
    for (const m of stringMatches) {
      paths.push(m[1]);
    }

    return paths;
  }

  // Check for single string matcher: '/path'
  const stringMatch = matcherPart.match(/['"]([^'"]+)['"]/);
  if (stringMatch) {
    return [stringMatch[1]];
  }

  return null;
}

/**
 * Check if any matcher pattern covers /api routes
 */
export function matcherCoversApi(matchers: string[]): boolean {
  for (const matcher of matchers) {
    // Direct /api match
    if (matcher === "/api" || matcher === "/api/:path*") {
      return true;
    }

    // Pattern starts with /api
    if (matcher.startsWith("/api/") || matcher.startsWith("/api:")) {
      return true;
    }

    // Catch-all that would include /api
    if (matcher === "/:path*" || matcher === "/(.*)" || matcher === "/(.*)") {
      return true;
    }

    // Negation pattern - check if it's excluding something else but including api
    // e.g., '/((?!_next/static|_next/image|favicon.ico).*)'
    if (matcher.includes("(?!") && !matcher.includes("api")) {
      return true;
    }
  }

  return false;
}

/**
 * Find API routes in Next.js app directory
 */
async function findApiRoutes(targetDir: string): Promise<string[]> {
  // Look for API routes in app directory (App Router)
  const appApiRoutes = await findFiles(
    ["app/**/route.{ts,js}", "src/app/**/route.{ts,js}"],
    { cwd: targetDir }
  );

  // Filter to only /api routes
  return appApiRoutes.filter(
    (r) => r.includes("/api/") || r.includes("\\api\\")
  );
}

/**
 * Next.js Middleware Gap Scanner
 *
 * Checks if middleware properly covers API routes
 */
export async function scanNextjsMiddleware(context: ScanContext): Promise<Finding[]> {
  const { targetDir } = context;
  const findings: Finding[] = [];

  // Only run for Next.js projects
  if (!isNextProject(targetDir)) {
    return findings;
  }

  // Find API routes
  const apiRoutes = await findApiRoutes(targetDir);
  const hasApiRoutes = apiRoutes.length > 0;

  if (!hasApiRoutes) {
    return findings; // No API routes to protect
  }

  // Check for middleware
  const middlewarePath = findMiddlewarePath(targetDir);

  if (!middlewarePath) {
    // No middleware file exists
    if (hasNextAuth(targetDir)) {
      // Has next-auth but no middleware - likely missing protection
      const evidence: EvidenceItem[] = [
        {
          file: "package.json",
          startLine: 1,
          endLine: 1,
          label: "next-auth dependency present",
        },
        ...apiRoutes.slice(0, 3).map((route) => ({
          file: route,
          startLine: 1,
          endLine: 1,
          label: "API route without middleware protection",
        })),
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_AUTH_INFO_001,
        file: "middleware.ts",
        symbol: "missing",
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_AUTH_INFO_001,
          file: "middleware.ts",
          symbol: "missing",
        }),
        severity: "medium",
        confidence: 0.7,
        category: "auth",
        ruleId: RULE_AUTH_INFO_001,
        title: "Next.js middleware missing with next-auth dependency",
        description: `This Next.js project uses next-auth but has no middleware.ts file. API routes (${apiRoutes.length} found) may lack server-side authentication enforcement. While next-auth provides session management, middleware is recommended for edge-level protection.`,
        evidence,
        remediation: {
          recommendedFix:
            "Create a middleware.ts file that checks authentication for protected routes. See: https://next-auth.js.org/configuration/nextjs#middleware",
        },
        links: {
          owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
        },
        fingerprint,
      });
    }

    return findings;
  }

  // Middleware exists - check if it covers API routes
  const middlewareContent = readFileSync(resolvePath(targetDir, middlewarePath));
  if (!middlewareContent) {
    return findings;
  }

  const matchers = parseMatcherConfig(middlewareContent);

  // If no matcher config, middleware applies to all routes (except static)
  if (matchers === null) {
    return findings; // Likely covers everything
  }

  // Check if matchers cover /api
  if (!matcherCoversApi(matchers)) {
    const lines = middlewareContent.split("\n");
    let configLine = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("config") && lines[i].includes("matcher")) {
        configLine = i + 1;
        break;
      }
    }

    const evidence: EvidenceItem[] = [
      {
        file: middlewarePath,
        startLine: configLine,
        endLine: configLine,
        snippet: `matcher: ${JSON.stringify(matchers)}`,
        label: "Middleware matcher does not include /api routes",
      },
      ...apiRoutes.slice(0, 2).map((route) => ({
        file: route,
        startLine: 1,
        endLine: 1,
        label: "API route not covered by middleware",
      })),
    ];

    const fingerprint = generateFingerprint({
      ruleId: RULE_MW_001,
      file: middlewarePath,
      symbol: "matcher",
    });

    findings.push({
      id: generateFindingId({
        ruleId: RULE_MW_001,
        file: middlewarePath,
        symbol: "matcher",
      }),
      severity: "high",
      confidence: 0.85,
      category: "middleware",
      ruleId: RULE_MW_001,
      title: "Next.js middleware matcher does not cover API routes",
      description: `The middleware.ts file has a matcher configuration that does not include /api routes. Found ${apiRoutes.length} API route(s) that are not protected by middleware. Current matcher: ${JSON.stringify(matchers)}`,
      evidence,
      remediation: {
        recommendedFix: `Update the middleware matcher to include API routes. Example: matcher: ['/((?!_next/static|_next/image|favicon.ico).*)', '/api/:path*']`,
      },
      links: {
        owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
      },
      fingerprint,
    });
  }

  return findings;
}

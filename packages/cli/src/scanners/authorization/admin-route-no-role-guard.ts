/**
 * VC-AUTHZ-001: Admin Route Lacks Role Guard
 *
 * Detects API routes with "admin" in the path or handler name that have
 * authentication checks but lack role-based authorization guards.
 *
 * Authentication proves identity; authorization proves permission.
 * An admin route should verify the user has admin privileges, not just
 * that they're logged in.
 *
 * Severity: High
 * Category: authorization
 * Confidence: 0.80
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext, RouteHandler } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-AUTHZ-001";

/**
 * Patterns that indicate admin-related routes
 */
const ADMIN_PATH_PATTERNS = [
  /\/admin\//i,
  /\/admin$/i,
  /\/administrator/i,
  /\/superuser/i,
  /\/staff\//i,
  /\/internal\//i,
  /\/management\//i,
  /\/backoffice/i,
];

/**
 * Patterns that indicate admin-related function names
 */
const ADMIN_FUNCTION_PATTERNS = [
  /admin/i,
  /superuser/i,
  /moderator/i,
  /staff/i,
];

/**
 * Auth check patterns (login required but not role-based)
 */
const AUTH_CHECK_PATTERNS = [
  "getServerSession",
  "getSession",
  "auth",
  "requireAuth",
  "withAuth",
  "verifyJwt",
  "verifyToken",
  "authenticate",
  "isAuthenticated",
  "checkAuth",
  "validateSession",
  "getToken",
];

/**
 * Role-based authorization patterns
 */
const ROLE_CHECK_PATTERNS = [
  // Direct role checks
  /session\.user\.role\s*[!=]==?\s*["'](admin|moderator|staff|superuser)["']/i,
  /user\.role\s*[!=]==?\s*["'](admin|moderator|staff|superuser)["']/i,
  /\.role\s*[!=]==?\s*["'](admin|moderator|staff|superuser)["']/i,
  /\.isAdmin/i,
  /\.is_admin/i,

  // Role includes check: .includes(session.user.role) or ["admin", "mod"].includes(role)
  /\.includes\s*\(\s*session\.user\.role\s*\)/i,
  /\[.*["']admin["'].*\]\.includes\s*\(/i,

  // Role checking functions
  /checkRole\s*\(/i,
  /hasRole\s*\(/i,
  /isRole\s*\(/i,
  /requireRole\s*\(/i,
  /authorizeRole\s*\(/i,
  /verifyRole\s*\(/i,
  /assertRole\s*\(/i,

  // Admin check functions
  /requireAdmin/i,
  /isAdmin\s*\(/i,
  /checkAdmin/i,
  /assertAdmin/i,
  /adminOnly/i,

  // Permission checks
  /hasPermission\s*\(/i,
  /checkPermission\s*\(/i,
  /requirePermission\s*\(/i,
  /can\s*\(\s*["']admin/i,
  /abilities\./i,
  /permissions\./i,

  // RBAC/ABAC libraries
  /casl/i,
  /accesscontrol/i,
  /rbac/i,
];

/**
 * Extract route path from file path
 */
function extractRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/(?:app|src\/app)(\/api\/[^/]+(?:\/[^/]+)*?)\/route\.[tj]sx?$/);
  if (match) {
    return match[1];
  }
  return normalized;
}

/**
 * Check if a path indicates an admin route
 */
function isAdminPath(routePath: string): boolean {
  return ADMIN_PATH_PATTERNS.some((pattern) => pattern.test(routePath));
}

/**
 * Check if handler name suggests admin functionality
 */
function isAdminHandler(handlerName: string): boolean {
  return ADMIN_FUNCTION_PATTERNS.some((pattern) => pattern.test(handlerName));
}

/**
 * Check if handler has basic auth checks
 */
function hasAuthCheck(handlerText: string): boolean {
  return AUTH_CHECK_PATTERNS.some((pattern) => handlerText.includes(pattern));
}

/**
 * Check if handler has role-based authorization
 */
function hasRoleCheck(handlerText: string): boolean {
  return ROLE_CHECK_PATTERNS.some((pattern) => pattern.test(handlerText));
}

/**
 * VC-AUTHZ-001: Admin Route Lacks Role Guard
 *
 * Scans for routes with "admin" in path/name that have auth but no role guard.
 */
export async function scanAdminRouteNoRoleGuard(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  // Only scan Next.js projects for now
  if (repoMeta.framework !== "next") {
    return findings;
  }

  // Scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const routePath = extractRoutePath(relPath);
    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const handlerText = helpers.getNodeText(handler.functionNode);

      // Check if this is an admin route (by path or handler name)
      const pathIsAdmin = isAdminPath(routePath);
      const handlerIsAdmin = isAdminHandler(handler.exportName);

      if (!pathIsAdmin && !handlerIsAdmin) {
        continue;
      }

      // Check if it has authentication
      if (!hasAuthCheck(handlerText)) {
        // No auth at all - different rule (VC-AUTH-001)
        continue;
      }

      // Check if it has role-based authorization
      if (hasRoleCheck(handlerText)) {
        // Has proper role guard - safe
        continue;
      }

      // Has auth but no role check - flag it
      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 300) + (handlerText.length > 300 ? "..." : ""),
          label: `Admin ${handler.method} handler with auth but no role guard`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: handler.method,
        route: routePath,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: handler.method,
        }),
        ruleId: RULE_ID,
        title: `Admin route ${routePath} has auth but no role guard`,
        description:
          `The ${handler.method} handler at ${routePath} has authentication checks ` +
          `(verifying user identity) but lacks role-based authorization (verifying admin privileges). ` +
          `Any authenticated user could potentially access this admin functionality. ` +
          `Authentication proves WHO you are; authorization proves WHAT you can do.`,
        severity: "high",
        confidence: 0.80,
        category: "authorization",
        evidence,
        remediation: {
          recommendedFix:
            `Add a role check after authentication. Example:\n\n` +
            `const session = await getServerSession();\n` +
            `if (!session) {\n` +
            `  return Response.json({ error: "Unauthorized" }, { status: 401 });\n` +
            `}\n` +
            `if (session.user.role !== "admin") {\n` +
            `  return Response.json({ error: "Forbidden" }, { status: 403 });\n` +
            `}\n\n` +
            `Consider using a role-based access control library like CASL or accesscontrol.`,
        },
        links: {
          owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
          cwe: "https://cwe.mitre.org/data/definitions/285.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

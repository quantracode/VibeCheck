/**
 * VC-AUTHZ-003: Role Declared But Never Enforced
 *
 * Detects patterns where role constants or types are defined in the codebase
 * but role checking logic is absent from API handlers.
 *
 * Example vulnerable pattern:
 *   // types/user.ts
 *   type Role = "admin" | "user" | "moderator";
 *
 *   // api/admin/route.ts
 *   export async function POST(request: Request) {
 *     // session.user.role is available but never checked
 *     const session = await getServerSession();
 *     // No role check before performing admin action
 *   }
 *
 * Severity: Medium
 * Category: authorization
 * Confidence: 0.70
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { SyntaxKind } from "ts-morph";

const RULE_ID = "VC-AUTHZ-003";

/**
 * Patterns for role type/constant declarations
 */
const ROLE_DECLARATION_PATTERNS = [
  // Type unions: type Role = "admin" | "user"
  /type\s+Role\s*=\s*["'][^"']+["']\s*\|/i,
  // Enum: enum Role { Admin, User }
  /enum\s+Role\s*\{/i,
  // Const object: const ROLES = { ADMIN: "admin", ... }
  /const\s+ROLES?\s*=\s*\{/i,
  // Role array: const roles = ["admin", "user"]
  /const\s+roles?\s*=\s*\[/i,
  // Interface with role: interface User { role: "admin" | "user" }
  /role\s*:\s*["'][^"']+["']\s*\|/i,
];

/**
 * Specific role values that indicate RBAC
 */
const ROLE_VALUES = [
  "admin",
  "administrator",
  "superuser",
  "moderator",
  "editor",
  "manager",
  "staff",
  "user",
  "guest",
  "viewer",
  "member",
];

/**
 * Patterns that indicate role checking logic is present
 */
const ROLE_CHECK_PATTERNS = [
  // Direct role comparison with session
  /session\.user\.role\s*[!=]==?\s*["'](admin|moderator|staff|manager|user)["']/i,
  /\.role\s*[!=]==?\s*["'](admin|moderator|staff|manager|user)["']/i,
  /["'](admin|moderator|staff|manager)["']\s*[!=]==?\s*\.role/i,

  // Role existence check: if (!session.user.role) or if (session.user.role)
  /!\s*session\.user\.role\b/i,
  /if\s*\(\s*session\.user\.role\b/i,

  // Role includes/has methods
  /\.role\s*===?\s*\w+\.ADMIN/i,
  /hasRole\s*\(/i,
  /checkRole\s*\(/i,
  /isRole\s*\(/i,
  /requireRole\s*\(/i,
  /roles?\.\s*includes\s*\(/i,
  /\[.*["']admin["'].*\]\.includes\s*\(.*session\.user\.role/i,
  /\.includes\s*\(\s*session\.user\.role\s*\)/i,

  // Admin checks
  /\.isAdmin/i,
  /isAdmin\s*\(/i,
  /requireAdmin/i,
  /adminOnly/i,

  // RBAC libraries
  /can\s*\(\s*["']/i,
  /abilities\./i,
  /casl/i,
  /accesscontrol/i,
];

/**
 * Auth patterns that indicate session is being used
 */
const AUTH_PATTERNS = [
  "getServerSession",
  "getSession",
  "auth(",
  "session.user",
  "currentUser",
];

interface RoleDeclaration {
  file: string;
  line: number;
  snippet: string;
  roles: string[];
}

/**
 * Find role declarations in the codebase
 */
function findRoleDeclarations(context: ScanContext): RoleDeclaration[] {
  const declarations: RoleDeclaration[] = [];
  const { repoRoot, fileIndex, helpers } = context;

  // Scan type files and config files
  const typeFiles = fileIndex.allSourceFiles.filter(
    (f) =>
      f.includes("/types/") ||
      f.includes("/types.") ||
      f.includes("/constants") ||
      f.includes("/config") ||
      f.includes("/auth") ||
      f.includes("/lib/")
  );

  for (const relPath of typeFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);
    if (!sourceFile) continue;

    const text = sourceFile.getFullText();

    // Check for role declarations
    for (const pattern of ROLE_DECLARATION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Extract role values from the text
        const rolesFound = ROLE_VALUES.filter((role) =>
          new RegExp(`["']${role}["']`, "i").test(text)
        );

        if (rolesFound.length > 1) {
          // Found multiple roles - this indicates RBAC
          const pos = match.index || 0;
          const line = sourceFile.getLineAndColumnAtPos(pos).line;

          declarations.push({
            file: relPath,
            line,
            snippet: match[0].slice(0, 100),
            roles: rolesFound,
          });
          break; // One declaration per file is enough
        }
      }
    }

    // Also check for Role enum/type definitions
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (/^role$/i.test(name)) {
        const typeText = typeAlias.getText();
        const rolesFound = ROLE_VALUES.filter((role) =>
          new RegExp(`["']${role}["']`, "i").test(typeText)
        );

        if (rolesFound.length > 1) {
          declarations.push({
            file: relPath,
            line: typeAlias.getStartLineNumber(),
            snippet: typeText.slice(0, 100),
            roles: rolesFound,
          });
        }
      }
    }

    // Check for Role enums
    const enums = sourceFile.getEnums();
    for (const enumDecl of enums) {
      const name = enumDecl.getName();
      if (/^role$/i.test(name)) {
        const members = enumDecl.getMembers().map((m) => m.getName().toLowerCase());
        const matchingRoles = members.filter((m) =>
          ROLE_VALUES.some((r) => m.includes(r))
        );

        if (matchingRoles.length > 1) {
          declarations.push({
            file: relPath,
            line: enumDecl.getStartLineNumber(),
            snippet: enumDecl.getText().slice(0, 100),
            roles: matchingRoles,
          });
        }
      }
    }
  }

  return declarations;
}

/**
 * Check if file has role enforcement
 */
function hasRoleEnforcement(handlerText: string): boolean {
  return ROLE_CHECK_PATTERNS.some((pattern) => pattern.test(handlerText));
}

/**
 * Check if file has auth/session access
 */
function hasAuthAccess(handlerText: string): boolean {
  return AUTH_PATTERNS.some((pattern) => handlerText.includes(pattern));
}

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
 * VC-AUTHZ-003: Role Declared But Never Enforced
 *
 * Scans for role declarations without corresponding enforcement in handlers.
 */
export async function scanRoleDeclaredNotEnforced(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  // Only scan Next.js projects for now
  if (repoMeta.framework !== "next") {
    return findings;
  }

  // First, find role declarations in the codebase
  const roleDeclarations = findRoleDeclarations(context);

  // If no role declarations found, nothing to check
  if (roleDeclarations.length === 0) {
    return findings;
  }

  // Check API routes for role enforcement
  const routesWithoutEnforcement: Array<{
    file: string;
    routePath: string;
    method: string;
    startLine: number;
    endLine: number;
    snippet: string;
  }> = [];

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const routePath = extractRoutePath(relPath);
    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      // Only check state-changing methods
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(handler.method)) {
        continue;
      }

      const handlerText = helpers.getNodeText(handler.functionNode);

      // Check if handler uses auth
      if (!hasAuthAccess(handlerText)) {
        continue;
      }

      // Check if handler enforces roles
      if (hasRoleEnforcement(handlerText)) {
        continue;
      }

      // Has auth but no role enforcement
      routesWithoutEnforcement.push({
        file: relPath,
        routePath,
        method: handler.method,
        startLine: handler.startLine,
        endLine: handler.endLine,
        snippet: handlerText.slice(0, 300) + (handlerText.length > 300 ? "..." : ""),
      });
    }
  }

  // Create findings for routes without enforcement
  // Only flag if we found role declarations AND routes without enforcement
  if (routesWithoutEnforcement.length > 0 && roleDeclarations.length > 0) {
    // Limit to first 3 routes per declaration to avoid noise
    const routesToFlag = routesWithoutEnforcement.slice(0, 5);

    for (const route of routesToFlag) {
      const roleDecl = roleDeclarations[0]; // Use first declaration as reference

      const evidence: EvidenceItem[] = [
        {
          file: roleDecl.file,
          startLine: roleDecl.line,
          endLine: roleDecl.line,
          snippet: roleDecl.snippet,
          label: `Role types defined: ${roleDecl.roles.join(", ")}`,
        },
        {
          file: route.file,
          startLine: route.startLine,
          endLine: route.endLine,
          snippet: route.snippet,
          label: `${route.method} handler without role check`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: route.file,
        symbol: route.method,
        route: route.routePath,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: route.file,
          symbol: route.method,
        }),
        ruleId: RULE_ID,
        title: `Roles defined but not enforced in ${route.routePath}`,
        description:
          `The codebase defines role types (${roleDecl.roles.join(", ")}) in ${roleDecl.file}, ` +
          `suggesting role-based access control is intended. However, the ${route.method} handler ` +
          `at ${route.routePath} has authentication but doesn't check the user's role. ` +
          `This may indicate incomplete RBAC implementation.`,
        severity: "medium",
        confidence: 0.70,
        category: "authorization",
        evidence,
        remediation: {
          recommendedFix:
            `Add role checking to the handler. Since roles are already defined in your codebase, ` +
            `implement enforcement:\n\n` +
            `const session = await getServerSession();\n` +
            `if (!session) {\n` +
            `  return Response.json({ error: "Unauthorized" }, { status: 401 });\n` +
            `}\n` +
            `if (!["admin", "moderator"].includes(session.user.role)) {\n` +
            `  return Response.json({ error: "Forbidden" }, { status: 403 });\n` +
            `}\n\n` +
            `Consider creating a reusable middleware or higher-order function for role checks.`,
        },
        links: {
          owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
          cwe: "https://cwe.mitre.org/data/definitions/862.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

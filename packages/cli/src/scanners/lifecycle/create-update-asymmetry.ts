/**
 * VC-LIFE-001: Create-Update Asymmetry
 *
 * Detects patterns where create operations have auth protection but
 * update operations for the same entity/route group do not.
 *
 * Example vulnerable pattern:
 *   // POST /api/posts - protected
 *   export async function POST(request: Request) {
 *     const session = await getServerSession();
 *     if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
 *     // creates post...
 *   }
 *
 *   // PUT /api/posts/[id] - NOT protected
 *   export async function PUT(request: Request) {
 *     const { id, title } = await request.json();
 *     await prisma.post.update({ where: { id }, data: { title } });
 *     // Missing auth check!
 *   }
 *
 * Severity: High
 * Category: lifecycle
 * Confidence: 0.85
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext, RouteHandler } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-LIFE-001";

/**
 * Entity info extracted from route analysis
 */
interface EntityRouteGroup {
  entityName: string;
  basePath: string;
  handlers: Array<{
    method: string;
    file: string;
    handler: RouteHandler;
    hasAuth: boolean;
    handlerText: string;
  }>;
}

/**
 * Extract entity name from route path
 * e.g., /api/posts/[id] -> posts, /api/users/[userId]/comments -> comments
 */
function extractEntityName(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  // Match /api/<entity> patterns
  const match = normalized.match(/\/api\/([a-z]+(?:-[a-z]+)*)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * Get base path for grouping (remove dynamic segments for comparison)
 */
function getBasePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  // Remove dynamic segments like [id], [userId] for grouping
  return normalized.replace(/\/\[[^\]]+\]/g, "").replace(/\/route\.[tj]sx?$/, "");
}

/**
 * Check if handler has authentication checks
 */
function hasAuthCheck(handlerText: string): boolean {
  const authPatterns = [
    /getServerSession\s*\(/,
    /auth\s*\(\)/,
    /requireAuth\s*\(/,
    /checkAuth\s*\(/,
    /isAuthenticated/,
    /session\s*\?\./,
    /!session\b/,
    /session\s*===?\s*null/,
    /currentUser/,
    /req\.user/,
    /middleware.*auth/i,
    /withAuth\s*\(/,
    /protectedRoute/i,
    /AuthGuard/,
  ];
  return authPatterns.some((pattern) => pattern.test(handlerText));
}

/**
 * VC-LIFE-001: Create-Update Asymmetry Scanner
 */
export async function scanCreateUpdateAsymmetry(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  // Only scan Next.js projects for now
  if (repoMeta.framework !== "next") {
    return findings;
  }

  // Group routes by entity
  const entityGroups = new Map<string, EntityRouteGroup>();

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const entityName = extractEntityName(relPath);
    if (!entityName) continue;

    const basePath = getBasePath(relPath);
    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      const handlerText = helpers.getNodeText(handler.functionNode);
      const hasAuth = hasAuthCheck(handlerText);

      // Create group key based on entity
      const groupKey = entityName;

      if (!entityGroups.has(groupKey)) {
        entityGroups.set(groupKey, {
          entityName,
          basePath,
          handlers: [],
        });
      }

      entityGroups.get(groupKey)!.handlers.push({
        method: handler.method,
        file: relPath,
        handler,
        hasAuth,
        handlerText,
      });
    }
  }

  // Analyze each entity group for create-update asymmetry
  for (const [entityKey, group] of entityGroups) {
    // Find POST handlers with auth (create operations)
    const protectedCreates = group.handlers.filter(
      (h) => h.method === "POST" && h.hasAuth
    );

    if (protectedCreates.length === 0) continue;

    // Find PUT/PATCH handlers without auth (update operations)
    const unprotectedUpdates = group.handlers.filter(
      (h) => (h.method === "PUT" || h.method === "PATCH") && !h.hasAuth
    );

    // Create findings for each unprotected update
    for (const unprotected of unprotectedUpdates) {
      const protectedExample = protectedCreates[0];

      const evidence: EvidenceItem[] = [
        {
          file: protectedExample.file,
          startLine: protectedExample.handler.startLine,
          endLine: Math.min(protectedExample.handler.startLine + 10, protectedExample.handler.endLine),
          snippet: protectedExample.handlerText.slice(0, 300) + "...",
          label: `Protected POST handler (creates ${group.entityName})`,
        },
        {
          file: unprotected.file,
          startLine: unprotected.handler.startLine,
          endLine: Math.min(unprotected.handler.startLine + 10, unprotected.handler.endLine),
          snippet: unprotected.handlerText.slice(0, 300) + "...",
          label: `Unprotected ${unprotected.method} handler (updates ${group.entityName})`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: unprotected.file,
        symbol: unprotected.method,
        route: group.basePath,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: unprotected.file,
          symbol: unprotected.method,
        }),
        ruleId: RULE_ID,
        title: `Create-update asymmetry for ${group.entityName}: POST protected but ${unprotected.method} is not`,
        description:
          `The POST handler for '${group.entityName}' requires authentication, but the ${unprotected.method} handler ` +
          `that modifies the same entity type does not have equivalent protection. This creates a lifecycle ` +
          `vulnerability where authenticated creation can be bypassed by unauthenticated modification. ` +
          `An attacker could modify ${group.entityName} records without proper authorization.`,
        severity: "high",
        confidence: 0.85,
        category: "lifecycle",
        evidence,
        remediation: {
          recommendedFix:
            `Add authentication checks to the ${unprotected.method} handler:\n\n` +
            `export async function ${unprotected.method}(request: Request) {\n` +
            `  const session = await getServerSession();\n` +
            `  if (!session) {\n` +
            `    return Response.json({ error: "Unauthorized" }, { status: 401 });\n` +
            `  }\n` +
            `  // ... rest of handler\n` +
            `}\n\n` +
            `Ensure all state-changing operations on '${group.entityName}' have consistent auth requirements.`,
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

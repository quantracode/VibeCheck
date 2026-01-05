/**
 * VC-AUTHZ-002: Ownership Check Missing
 *
 * Detects patterns where a userId or resourceId is extracted from request
 * params/body but not compared against the authenticated user's session.
 *
 * Example vulnerable pattern:
 *   const { userId } = await request.json();
 *   await prisma.user.update({ where: { id: userId }, ... });
 *   // Never checks if userId === session.user.id
 *
 * Severity: Critical
 * Category: authorization
 * Confidence: 0.75
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext, FunctionNode } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";
import { SyntaxKind, Node } from "ts-morph";

const RULE_ID = "VC-AUTHZ-002";

/**
 * User/resource ID parameter names that should trigger ownership checks
 */
const USER_ID_PARAMS = [
  "userId",
  "user_id",
  "userid",
  "ownerId",
  "owner_id",
  "authorId",
  "author_id",
  "creatorId",
  "creator_id",
  "accountId",
  "account_id",
  "memberId",
  "member_id",
  "profileId",
  "profile_id",
];

/**
 * Resource ID params that indicate operating on owned resources
 */
const RESOURCE_ID_PARAMS = [
  "id",
  "postId",
  "post_id",
  "commentId",
  "comment_id",
  "documentId",
  "document_id",
  "itemId",
  "item_id",
  "orderId",
  "order_id",
];

/**
 * Patterns that indicate userId is being extracted from request
 */
const USER_ID_EXTRACTION_PATTERNS = [
  // Destructuring: const { userId } = await request.json()
  /\{\s*(?:.*,\s*)?(userId|user_id|ownerId|owner_id|authorId|author_id)\s*(?:,\s*.*)?\}\s*=\s*(?:await\s+)?(?:request\.json|req\.body|body)/i,
  // Direct access: body.userId, params.userId
  /(?:body|params|data|payload)\.(?:userId|user_id|ownerId|owner_id|authorId|author_id)/i,
  // URL params: params.userId
  /params\.get\s*\(\s*["'](?:userId|user_id|ownerId)["']\s*\)/i,
];

/**
 * Patterns that indicate an ownership comparison is being made
 */
const OWNERSHIP_CHECK_PATTERNS = [
  // Direct equality: userId === session.user.id
  /(?:userId|user_id|ownerId|owner_id|authorId)\s*===?\s*session\.user\.id/i,
  /session\.user\.id\s*===?\s*(?:userId|user_id|ownerId|owner_id|authorId)/i,

  // Inequality check for ownership: userId !== session.user.id
  /(?:userId|user_id|ownerId|owner_id|authorId)\s*!==?\s*session\.user\.id/i,
  /session\.user\.id\s*!==?\s*(?:userId|user_id|ownerId|owner_id|authorId)/i,

  // Function-based checks
  /isOwner\s*\(/i,
  /checkOwnership\s*\(/i,
  /verifyOwnership\s*\(/i,
  /canAccess\s*\(/i,
  /belongsTo\s*\(/i,
  /ownedBy\s*\(/i,

  // Prisma where clause with session user
  /where\s*:\s*\{[^}]*(?:userId|user_id|ownerId|authorId)\s*:\s*session\.user\.id/i,
  /where\s*:\s*\{[^}]*userId\s*:\s*user\.id/i,

  // Combined auth + resource check
  /\.findFirst\s*\([^)]*where\s*:\s*\{[^}]*AND/i,

  // Finding resource by session user (safe pattern for ownership)
  /authorId\s*:\s*session\.user\.id/i,
  /ownerId\s*:\s*session\.user\.id/i,
  /userId\s*:\s*session\.user\.id/i,
  /creatorId\s*:\s*session\.user\.id/i,

  // Role-based authorization (admin/moderator can access any resource)
  /session\.user\.role\s*[!=]==?\s*["']admin["']/i,
  /\.role\s*[!=]==?\s*["']admin["']/i,
  /\.includes\s*\(\s*session\.user\.role\s*\)/i,
  /\[.*["']admin["'].*\]\.includes/i,
];

/**
 * Patterns for dangerous operations that need ownership checks
 */
const DANGEROUS_OPS_PATTERNS = [
  /prisma\.\w+\.update/i,
  /prisma\.\w+\.delete/i,
  /prisma\.\w+\.upsert/i,
  /\.update\s*\(/i,
  /\.delete\s*\(/i,
  /\.destroy\s*\(/i,
  /\.remove\s*\(/i,
  /db\.\w+\.update/i,
  /db\.\w+\.delete/i,
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
 * Check if handler extracts user/owner ID from request body
 */
function extractsUserId(handlerText: string): { found: boolean; param?: string; snippet?: string } {
  // First, check if there's body extraction (request.json() or req.body)
  const hasBodyExtraction = /(?:await\s+)?(?:request\.json|req\.body)\s*\(\s*\)|\.json\s*\(\s*\)/.test(handlerText);
  if (!hasBodyExtraction) {
    return { found: false };
  }

  // Check for user ID params in destructuring from body
  for (const param of USER_ID_PARAMS) {
    // Pattern: { userId, ... } = await request.json()
    const pattern = new RegExp(`\\{[^}]*\\b${param}\\b[^}]*\\}\\s*=\\s*(?:await\\s+)?`, "i");
    if (pattern.test(handlerText)) {
      const match = handlerText.match(pattern);
      return {
        found: true,
        param,
        snippet: match?.[0] || param,
      };
    }
  }

  // Check for direct access patterns: body.userId, data.ownerId
  for (const param of USER_ID_PARAMS) {
    const directPattern = new RegExp(`(?:body|data|payload)\\.${param}\\b`, "i");
    if (directPattern.test(handlerText)) {
      const match = handlerText.match(directPattern);
      return {
        found: true,
        param,
        snippet: match?.[0] || param,
      };
    }
  }

  return { found: false };
}

/**
 * Check if handler has ownership verification
 */
function hasOwnershipCheck(handlerText: string): boolean {
  return OWNERSHIP_CHECK_PATTERNS.some((pattern) => pattern.test(handlerText));
}

/**
 * Check if handler performs dangerous operations
 */
function hasDangerousOps(handlerText: string): boolean {
  return DANGEROUS_OPS_PATTERNS.some((pattern) => pattern.test(handlerText));
}

/**
 * Check for session/auth access in handler
 */
function hasSessionAccess(handlerText: string): boolean {
  return /session\.user|getServerSession|auth\(\)|currentUser|req\.user/i.test(handlerText);
}

/**
 * VC-AUTHZ-002: Ownership Check Missing
 *
 * Scans for handlers that extract userId from request but don't verify ownership.
 */
export async function scanOwnershipCheckMissing(context: ScanContext): Promise<Finding[]> {
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
      // Only check state-changing methods
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(handler.method)) {
        continue;
      }

      const handlerText = helpers.getNodeText(handler.functionNode);

      // Check if userId is extracted from request
      const userIdExtraction = extractsUserId(handlerText);
      if (!userIdExtraction.found) {
        continue;
      }

      // Check if handler performs dangerous operations
      if (!hasDangerousOps(handlerText)) {
        continue;
      }

      // Check if handler has session access (auth is present)
      if (!hasSessionAccess(handlerText)) {
        // No session access - different rule
        continue;
      }

      // Check if ownership is verified
      if (hasOwnershipCheck(handlerText)) {
        // Has ownership check - safe
        continue;
      }

      // Has userId extraction + dangerous ops + session but no ownership check
      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 400) + (handlerText.length > 400 ? "..." : ""),
          label: `${handler.method} handler extracts ${userIdExtraction.param} without ownership check`,
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
        title: `Missing ownership check for ${userIdExtraction.param} in ${routePath}`,
        description:
          `The ${handler.method} handler at ${routePath} extracts '${userIdExtraction.param}' from the request ` +
          `and performs database operations, but never verifies that this ID belongs to the authenticated user. ` +
          `An attacker could modify or delete another user's resources by supplying a different user ID. ` +
          `This is an Insecure Direct Object Reference (IDOR) vulnerability.`,
        severity: "critical",
        confidence: 0.75,
        category: "authorization",
        evidence,
        remediation: {
          recommendedFix:
            `Verify that the requested resource belongs to the authenticated user:\n\n` +
            `// Option 1: Compare IDs explicitly\n` +
            `if (userId !== session.user.id) {\n` +
            `  return Response.json({ error: "Forbidden" }, { status: 403 });\n` +
            `}\n\n` +
            `// Option 2: Include ownership in the database query\n` +
            `const resource = await prisma.post.findFirst({\n` +
            `  where: { id: postId, authorId: session.user.id }\n` +
            `});\n` +
            `if (!resource) {\n` +
            `  return Response.json({ error: "Not found" }, { status: 404 });\n` +
            `}`,
        },
        links: {
          owasp: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/",
          cwe: "https://cwe.mitre.org/data/definitions/639.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

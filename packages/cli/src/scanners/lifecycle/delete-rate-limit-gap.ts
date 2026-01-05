/**
 * VC-LIFE-003: Delete Rate Limit Gap
 *
 * Detects patterns where other state-changing operations (POST, PUT, PATCH)
 * have rate limiting but DELETE endpoints do not.
 *
 * Example vulnerable pattern:
 *   // POST /api/posts - rate limited
 *   export const POST = withRateLimit(async (request: Request) => {
 *     // creates post with rate limit protection
 *   });
 *
 *   // DELETE /api/posts/[id] - NO rate limit
 *   export async function DELETE(request: Request) {
 *     await prisma.post.delete({ where: { id } });
 *     // Can be called unlimited times - enables mass deletion attacks
 *   }
 *
 * Severity: Medium
 * Category: lifecycle
 * Confidence: 0.75
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext, RouteHandler } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-LIFE-003";

/**
 * Entity route info for grouping
 */
interface EntityRateLimitGroup {
  entityName: string;
  basePath: string;
  handlers: Array<{
    method: string;
    file: string;
    handler: RouteHandler;
    hasRateLimit: boolean;
    rateLimitType?: string;
    handlerText: string;
    fullFileText: string;
  }>;
}

/**
 * Rate limiting patterns and their types
 */
const RATE_LIMIT_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Wrapper functions
  { pattern: /withRateLimit\s*\(/, type: "wrapper" },
  { pattern: /rateLimit\s*\(/, type: "wrapper" },
  { pattern: /rateLimiter\s*\(/, type: "wrapper" },
  { pattern: /throttle\s*\(/, type: "wrapper" },

  // Import-based detection
  { pattern: /import.*(?:rateLimit|RateLimiter).*from/, type: "import" },
  { pattern: /import.*upstash.*ratelimit/i, type: "upstash" },
  { pattern: /import.*@upstash\/ratelimit/i, type: "upstash" },

  // Direct library usage
  { pattern: /Ratelimit\s*\(/, type: "upstash" },
  { pattern: /new\s+RateLimiter\s*\(/, type: "custom" },
  { pattern: /limiter\.limit\s*\(/, type: "custom" },
  { pattern: /rateLimiter\.check\s*\(/, type: "custom" },

  // Redis-based rate limiting
  { pattern: /redis\.incr\s*\(.*rate/i, type: "redis" },
  { pattern: /INCR.*:ratelimit/i, type: "redis" },

  // Comment/identifier hints
  { pattern: /@rateLimit/i, type: "decorator" },
  { pattern: /RateLimited/i, type: "decorator" },

  // Middleware patterns
  { pattern: /app\.use\s*\(\s*rateLimit/i, type: "middleware" },
  { pattern: /limiter\s*=.*sliding.*window/i, type: "custom" },
];

/**
 * Extract entity name from route path
 */
function extractEntityName(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/\/api\/([a-z]+(?:-[a-z]+)*)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return null;
}

/**
 * Get base path for grouping
 */
function getBasePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.replace(/\/\[[^\]]+\]/g, "").replace(/\/route\.[tj]sx?$/, "");
}

/**
 * Detect rate limiting in handler or file
 */
function detectRateLimit(handlerText: string, fullFileText: string): { hasRateLimit: boolean; type?: string } {
  // Check handler text first
  for (const { pattern, type } of RATE_LIMIT_PATTERNS) {
    if (pattern.test(handlerText)) {
      return { hasRateLimit: true, type };
    }
  }

  // Check for file-level rate limit imports/setup that might apply to all handlers
  const filePatterns = [
    /import.*(?:rateLimit|RateLimiter).*from/i,
    /const\s+(?:rateLimit|limiter)\s*=/i,
    /withRateLimit/,
  ];

  for (const pattern of filePatterns) {
    if (pattern.test(fullFileText)) {
      // Check if the rate limit is actually used in this handler
      if (/withRateLimit\s*\(/.test(handlerText) || /limiter\./.test(handlerText)) {
        return { hasRateLimit: true, type: "file-level" };
      }
    }
  }

  return { hasRateLimit: false };
}

/**
 * Check if handler performs destructive operations
 */
function hasDestructiveOps(handlerText: string): boolean {
  return /\.delete\s*\(|\.destroy\s*\(|\.remove\s*\(|prisma\.\w+\.delete|deleteMany\s*\(/i.test(handlerText);
}

/**
 * VC-LIFE-003: Delete Rate Limit Gap Scanner
 */
export async function scanDeleteRateLimitGap(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers, repoMeta } = context;
  const findings: Finding[] = [];

  if (repoMeta.framework !== "next") {
    return findings;
  }

  // Group routes by entity
  const entityGroups = new Map<string, EntityRateLimitGroup>();

  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    const entityName = extractEntityName(relPath);
    if (!entityName) continue;

    const basePath = getBasePath(relPath);
    const handlers = helpers.findRouteHandlers(sourceFile);
    const fullFileText = sourceFile.getFullText();

    for (const handler of handlers) {
      // Only check state-changing methods
      if (!["POST", "PUT", "PATCH", "DELETE"].includes(handler.method)) continue;

      const handlerText = helpers.getNodeText(handler.functionNode);
      const { hasRateLimit, type } = detectRateLimit(handlerText, fullFileText);

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
        hasRateLimit,
        rateLimitType: type,
        handlerText,
        fullFileText,
      });
    }
  }

  // Analyze each entity group for rate limit gaps on DELETE
  for (const [entityKey, group] of entityGroups) {
    // Find handlers with rate limiting (POST, PUT, PATCH)
    const rateLimitedHandlers = group.handlers.filter(
      (h) => h.method !== "DELETE" && h.hasRateLimit
    );

    if (rateLimitedHandlers.length === 0) continue;

    // Find DELETE handlers without rate limiting that have destructive ops
    const unprotectedDeletes = group.handlers.filter(
      (h) =>
        h.method === "DELETE" &&
        !h.hasRateLimit &&
        hasDestructiveOps(h.handlerText)
    );

    for (const unprotected of unprotectedDeletes) {
      const rateLimitedExample = rateLimitedHandlers[0];

      const evidence: EvidenceItem[] = [
        {
          file: rateLimitedExample.file,
          startLine: rateLimitedExample.handler.startLine,
          endLine: Math.min(rateLimitedExample.handler.startLine + 10, rateLimitedExample.handler.endLine),
          snippet: rateLimitedExample.handlerText.slice(0, 250) + "...",
          label: `Rate-limited ${rateLimitedExample.method} handler (${rateLimitedExample.rateLimitType || "rate limit"})`,
        },
        {
          file: unprotected.file,
          startLine: unprotected.handler.startLine,
          endLine: Math.min(unprotected.handler.startLine + 10, unprotected.handler.endLine),
          snippet: unprotected.handlerText.slice(0, 250) + "...",
          label: `DELETE handler without rate limiting - enables mass deletion`,
        },
      ];

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: unprotected.file,
        symbol: "DELETE",
        route: group.basePath,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: unprotected.file,
          symbol: "DELETE",
        }),
        ruleId: RULE_ID,
        title: `Delete rate limit gap for ${group.entityName}: other methods rate-limited but DELETE is not`,
        description:
          `The ${rateLimitedExample.method} handler for '${group.entityName}' has rate limiting, but the DELETE ` +
          `handler does not. This asymmetry allows attackers to rapidly delete resources without throttling. ` +
          `A malicious actor could enumerate IDs and mass-delete ${group.entityName} records, causing ` +
          `data loss that would be prevented on other operations.`,
        severity: "medium",
        confidence: 0.75,
        category: "lifecycle",
        evidence,
        remediation: {
          recommendedFix:
            `Apply rate limiting to the DELETE handler:\n\n` +
            `// Using the same rate limiter as other endpoints:\n` +
            `export const DELETE = withRateLimit(async (request: Request) => {\n` +
            `  // ... delete logic\n` +
            `});\n\n` +
            `// Or with Upstash:\n` +
            `import { Ratelimit } from "@upstash/ratelimit";\n` +
            `const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") });\n\n` +
            `export async function DELETE(request: Request) {\n` +
            `  const { success } = await ratelimit.limit(userId);\n` +
            `  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });\n` +
            `  // ... delete logic\n` +
            `}`,
        },
        links: {
          owasp: "https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/",
          cwe: "https://cwe.mitre.org/data/definitions/770.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

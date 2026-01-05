/**
 * VC-AUTHZ-004: Server Trusts Client-Provided userId/tenantId
 *
 * Detects patterns where the server uses a userId or tenantId directly from
 * the request body to perform write operations, without deriving it from
 * the authenticated session.
 *
 * Example vulnerable pattern:
 *   const { userId, data } = await request.json();
 *   await prisma.post.create({
 *     data: { ...data, authorId: userId }  // userId from client!
 *   });
 *   // Should use: authorId: session.user.id
 *
 * Severity: Critical
 * Category: authorization
 * Confidence: 0.85
 */

import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-AUTHZ-004";

/**
 * Client-provided ID parameter names that should not be trusted for writes
 */
const UNTRUSTED_ID_PARAMS = [
  "userId",
  "user_id",
  "userid",
  "ownerId",
  "owner_id",
  "authorId",
  "author_id",
  "creatorId",
  "creator_id",
  "tenantId",
  "tenant_id",
  "organizationId",
  "organization_id",
  "orgId",
  "org_id",
  "teamId",
  "team_id",
  "companyId",
  "company_id",
  "accountId",
  "account_id",
];

/**
 * Patterns that indicate extracting IDs from request body
 */
function buildExtractionPatterns(): RegExp[] {
  return UNTRUSTED_ID_PARAMS.flatMap((param) => [
    // Destructuring: const { userId } = body
    new RegExp(`\\{[^}]*\\b${param}\\b[^}]*\\}\\s*=\\s*(?:await\\s+)?(?:request\\.json|req\\.body|body|data|payload)`, "i"),
    // Direct access: body.userId
    new RegExp(`(?:body|data|payload|json)\\s*\\.\\s*${param}\\b`, "i"),
  ]);
}

/**
 * Patterns that indicate using client ID in write operations
 */
function buildWriteUsagePatterns(): RegExp[] {
  return UNTRUSTED_ID_PARAMS.flatMap((param) => [
    // Prisma create with client ID: authorId: userId
    new RegExp(`(?:create|insert|upsert)[^}]*\\{[^}]*${param}\\s*:\\s*${param}(?:\\b|[^.])`, "i"),
    // Prisma create with body ID: authorId: body.userId
    new RegExp(`(?:create|insert|upsert)[^}]*\\{[^}]*${param}\\s*:\\s*(?:body|data|payload)\\.${param}`, "i"),
    // Spread with override: { ...data, authorId: userId }
    new RegExp(`\\.\\.\\.[^,}]+,\\s*${param}\\s*:\\s*${param}(?:\\b|[^.])`, "i"),
    // Direct assignment in data: data: { userId: req.body.userId }
    new RegExp(`data\\s*:\\s*\\{[^}]*${param}\\s*:\\s*(?:req\\.body|body|data)\\.${param}`, "i"),
  ]);
}

/**
 * Check if handler uses safe session-derived ID for the write operation
 * This is more specific than pattern matching - we check if session.user.id
 * is actually used in the data being written, not just mentioned in comments
 */
function usesSafeSessionIdInWrite(handlerText: string): boolean {
  // Remove comments to avoid false positives
  const codeOnly = handlerText
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

  // Check for patterns where session.user.id is used in write data
  const safePatterns = [
    // authorId: session.user.id or userId: session.user.id
    /(?:authorId|ownerId|creatorId|userId|tenantId|organizationId)\s*:\s*session\.user\.id/i,
    // Using currentUser.id
    /(?:authorId|ownerId|creatorId|userId)\s*:\s*currentUser\.id/i,
    // Using user.id from validated context
    /(?:authorId|ownerId|creatorId|userId)\s*:\s*user\.id/i,
  ];

  return safePatterns.some((p) => p.test(codeOnly));
}

/**
 * Patterns for write operations
 */
const WRITE_OP_PATTERNS = [
  /\.create\s*\(/i,
  /\.insert\s*\(/i,
  /\.upsert\s*\(/i,
  /\.createMany\s*\(/i,
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
 * Check if handler extracts untrusted IDs from client
 */
function extractsUntrustedId(handlerText: string): { found: boolean; param?: string } {
  // Check for request.json() or similar pattern first
  const hasBodyExtraction = /(?:await\s+)?(?:request\.json|req\.body)\s*\(\s*\)|\.json\s*\(\s*\)/.test(handlerText);
  if (!hasBodyExtraction) {
    return { found: false };
  }

  for (const param of UNTRUSTED_ID_PARAMS) {
    // Check if param appears in destructuring pattern: const { userId, ... } =
    const destructurePattern = new RegExp(`\\{[^}]*\\b${param}\\b[^}]*\\}\\s*=`, "i");
    // Check for direct access: body.userId
    const directPattern = new RegExp(`(?:body|data|payload)\\.${param}\\b`, "i");

    if (destructurePattern.test(handlerText) || directPattern.test(handlerText)) {
      return { found: true, param };
    }
  }

  return { found: false };
}

/**
 * Check if the client ID is used in write operations
 */
function usesClientIdInWrite(handlerText: string, param: string): { found: boolean; snippet?: string } {
  // Check if there's a write operation
  const hasWriteOp = WRITE_OP_PATTERNS.some((p) => p.test(handlerText));
  if (!hasWriteOp) {
    return { found: false };
  }

  // Check for direct use of client-provided ID in write data object
  // Pattern: authorId: userId, (where userId came from body)
  // The param variable appears as a value assigned to an ID field
  const directUsePattern = new RegExp(
    `(?:authorId|ownerId|creatorId|userId|tenantId|organizationId)\\s*:\\s*${param}(?:\\s*,|\\s*})`,
    "i"
  );
  if (directUsePattern.test(handlerText)) {
    const match = handlerText.match(directUsePattern);
    return { found: true, snippet: match?.[0]?.replace(/[,}]$/, "").trim() };
  }

  // Also check for multiline: authorId: userId (with potential newline before comma)
  const multilinePattern = new RegExp(
    `(?:authorId|ownerId|creatorId|userId|tenantId|organizationId)\\s*:\\s*${param}\\b`,
    "i"
  );
  if (multilinePattern.test(handlerText)) {
    // Make sure it's not authorId: session.user.id or similar safe pattern
    const contextPattern = new RegExp(
      `(?:authorId|ownerId|creatorId|userId)\\s*:\\s*${param}\\s*(?:,|//|$)`,
      "im"
    );
    if (contextPattern.test(handlerText)) {
      const match = handlerText.match(multilinePattern);
      return { found: true, snippet: match?.[0]?.trim() };
    }
  }

  // Pattern: authorId: body.userId
  const bodyUsePattern = new RegExp(
    `(?:authorId|ownerId|creatorId|userId|tenantId|organizationId)\\s*:\\s*(?:body|data|payload)\\.${param}`,
    "i"
  );
  if (bodyUsePattern.test(handlerText)) {
    const match = handlerText.match(bodyUsePattern);
    return { found: true, snippet: match?.[0] };
  }

  // Pattern: spreading request data that includes userId
  // { ...body } or { ...data } where body contains userId
  const spreadPattern = /\{\s*\.\.\.(?:body|data|payload|json)/i;
  if (spreadPattern.test(handlerText)) {
    // Check if session.user.id is used to override
    if (!SAFE_ID_PATTERNS.some((p) => p.test(handlerText))) {
      return { found: true, snippet: "spreading request data without overriding user ID" };
    }
  }

  return { found: false };
}

/**
 * Check if handler uses safe session-derived ID (wrapper for the new function)
 */
function usesSafeSessionId(handlerText: string): boolean {
  return usesSafeSessionIdInWrite(handlerText);
}

/**
 * VC-AUTHZ-004: Server Trusts Client-Provided userId/tenantId
 *
 * Scans for handlers that use client-provided user/tenant IDs for writes.
 */
export async function scanTrustedClientId(context: ScanContext): Promise<Finding[]> {
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
      // Only check POST (create operations)
      if (handler.method !== "POST") {
        continue;
      }

      const handlerText = helpers.getNodeText(handler.functionNode);

      // Check if handler has write operations
      const hasWriteOp = WRITE_OP_PATTERNS.some((p) => p.test(handlerText));
      if (!hasWriteOp) {
        continue;
      }

      // Check if untrusted ID is extracted from request
      const extraction = extractsUntrustedId(handlerText);
      if (!extraction.found) {
        continue;
      }

      // Check if client ID is used in write operation
      const writeUsage = usesClientIdInWrite(handlerText, extraction.param!);
      if (!writeUsage.found) {
        continue;
      }

      // Check if session-derived ID is used (safe pattern)
      if (usesSafeSessionId(handlerText)) {
        continue;
      }

      // Vulnerable: client ID used in write without session verification
      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 400) + (handlerText.length > 400 ? "..." : ""),
          label: `POST handler uses client-provided ${extraction.param} for write: ${writeUsage.snippet}`,
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
        title: `Server trusts client-provided ${extraction.param} in ${routePath}`,
        description:
          `The POST handler at ${routePath} extracts '${extraction.param}' from the request body ` +
          `and uses it directly in a write operation (${writeUsage.snippet}). ` +
          `An attacker can impersonate any user by supplying a different ID in the request body. ` +
          `User and tenant IDs for write operations must always come from the authenticated session, ` +
          `never from client input.`,
        severity: "critical",
        confidence: 0.85,
        category: "authorization",
        evidence,
        remediation: {
          recommendedFix:
            `Always derive user/tenant IDs from the authenticated session:\n\n` +
            `// UNSAFE - trusting client input\n` +
            `const { userId, content } = await request.json();\n` +
            `await prisma.post.create({ data: { content, authorId: userId } });\n\n` +
            `// SAFE - using session\n` +
            `const session = await getServerSession();\n` +
            `const { content } = await request.json();\n` +
            `await prisma.post.create({ data: { content, authorId: session.user.id } });\n\n` +
            `Never accept user/tenant identifiers from client-controlled input.`,
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

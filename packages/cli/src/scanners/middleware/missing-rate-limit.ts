import type { Finding, EvidenceItem } from "@vibecheck/schema";
import type { ScanContext } from "../types.js";
import { resolvePath } from "../../utils/file-utils.js";
import { generateFingerprint, generateFindingId } from "../../utils/fingerprint.js";

const RULE_ID = "VC-RATE-001";

/**
 * State-changing HTTP methods
 */
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Keywords that suggest sensitive operations
 */
const SENSITIVE_SINK_PATTERNS = /create|insert|update|delete|send|email|mail|payment|charge|login|signup|register|auth|password|reset/i;

/**
 * VC-RATE-001: Missing rate limiting on public state-changing endpoints
 *
 * Only consider POST/PUT/PATCH/DELETE route handlers that:
 * - appear unauthenticated (no auth check)
 * - AND include a sink: DB write, email send, payment, or login/signup keywords
 *
 * If no rate-limit signals found in handler or middleware, flag it.
 */
export async function scanMissingRateLimit(context: ScanContext): Promise<Finding[]> {
  const { repoRoot, fileIndex, helpers } = context;
  const findings: Finding[] = [];

  // Check if middleware has rate limiting
  let middlewareHasRateLimit = false;
  if (fileIndex.middlewareFile) {
    const middlewarePath = resolvePath(repoRoot, fileIndex.middlewareFile);
    const middlewareSource = helpers.parseFile(middlewarePath);
    if (middlewareSource) {
      middlewareHasRateLimit = helpers.hasRateLimitSignals(middlewareSource);
    }
  }

  // If middleware already has rate limiting, skip this scanner
  if (middlewareHasRateLimit) {
    return findings;
  }

  // Scan API route files
  for (const relPath of fileIndex.apiRouteFiles) {
    const absPath = resolvePath(repoRoot, relPath);
    const sourceFile = helpers.parseFile(absPath);

    if (!sourceFile) continue;

    // Check if file has rate limiting
    const fileHasRateLimit = helpers.hasRateLimitSignals(sourceFile);
    if (fileHasRateLimit) continue;

    const handlers = helpers.findRouteHandlers(sourceFile);

    for (const handler of handlers) {
      // Only check state-changing methods
      if (!STATE_CHANGING_METHODS.includes(handler.method)) {
        continue;
      }

      // Check for auth - only flag unauthenticated endpoints
      const hasAuth = helpers.containsAuthCheck(handler.functionNode);
      if (hasAuth) continue;

      // Find sensitive sinks
      const dbSinks = helpers.findDbSinks(handler.functionNode);
      const handlerText = helpers.getNodeText(handler.functionNode);
      const hasSensitiveSink = dbSinks.length > 0 || SENSITIVE_SINK_PATTERNS.test(handlerText);

      if (!hasSensitiveSink) continue;

      const evidence: EvidenceItem[] = [
        {
          file: relPath,
          startLine: handler.startLine,
          endLine: handler.endLine,
          snippet: handlerText.slice(0, 200) + "...",
          label: `Unauthenticated ${handler.method} handler without rate limiting`,
        },
      ];

      // Add sink evidence
      if (dbSinks.length > 0) {
        evidence.push({
          file: relPath,
          startLine: dbSinks[0].line,
          endLine: dbSinks[0].line,
          snippet: dbSinks[0].snippet,
          label: `Sensitive operation: ${dbSinks[0].kind}.${dbSinks[0].operation}`,
        });
      }

      const fingerprint = generateFingerprint({
        ruleId: RULE_ID,
        file: relPath,
        symbol: handler.method,
        startLine: handler.startLine,
      });

      findings.push({
        id: generateFindingId({
          ruleId: RULE_ID,
          file: relPath,
          symbol: handler.method,
          startLine: handler.startLine,
        }),
        ruleId: RULE_ID,
        title: `Missing rate limiting on public ${handler.method} endpoint`,
        description: `This public (unauthenticated) ${handler.method} handler performs sensitive operations but lacks rate limiting. Without rate limiting, attackers can abuse this endpoint for credential stuffing, brute force attacks, or denial of service by overwhelming your resources.`,
        severity: "medium",
        confidence: 0.65,
        category: "middleware",
        evidence,
        remediation: {
          recommendedFix: `Add rate limiting to protect against abuse. Consider using @upstash/ratelimit for serverless, or express-rate-limit for Express apps.`,
          patch: `// Using @upstash/ratelimit with Vercel KV:
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    });
  }

  // ... rest of handler
}`,
        },
        links: {
          owasp: "https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html",
          cwe: "https://cwe.mitre.org/data/definitions/770.html",
        },
        fingerprint,
      });
    }
  }

  return findings;
}

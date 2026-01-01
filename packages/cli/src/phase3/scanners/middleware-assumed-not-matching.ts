/**
 * VC-HALL-011: Middleware Assumed But Not Matching
 *
 * Detects routes that appear to expect middleware protection
 * but are not covered by the middleware matcher patterns.
 *
 * Severity: High
 * Category: hallucinations
 * Confidence: 0.70
 */

import crypto from "node:crypto";
import type { Finding } from "@vibecheck/schema";
import type { ScanContext, RouteInfo, IntentClaim } from "../../scanners/types.js";
import {
  buildRouteMap,
  buildMiddlewareMap,
  isRouteCoveredByMiddleware,
} from "../proof-trace-builder.js";
import { mineAllIntentClaims } from "../intent-miner.js";

const RULE_ID = "VC-HALL-011";

/**
 * Signals that a route expects middleware protection
 */
const MIDDLEWARE_EXPECTATION_SIGNALS = [
  // Comments
  /middleware.*protect/i,
  /protected\s*by\s*middleware/i,
  /middleware\s*handles?\s*auth/i,
  /auth\s*(is|handled)\s*(by|in)\s*middleware/i,

  // Code patterns that suggest middleware dependency
  /withMiddleware/,
  /requireMiddleware/,
  /middlewareProtected/,
];

export async function scanMiddlewareAssumedNotMatching(
  ctx: ScanContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Build maps
  const routes = buildRouteMap(ctx);
  const middlewareMap = buildMiddlewareMap(ctx);

  // If no middleware file exists, skip this scanner
  if (middlewareMap.length === 0) {
    return findings;
  }

  const allMatchers = middlewareMap.flatMap((m) => m.matchers);
  const intentClaims = mineAllIntentClaims(ctx, routes);

  // Find routes that expect middleware but aren't covered
  for (const route of routes) {
    const isCovered = isRouteCoveredByMiddleware(route.path, allMatchers);

    if (isCovered) continue;

    // Check if this route has signals expecting middleware
    const expectsMiddleware = checkMiddlewareExpectation(ctx, route, intentClaims);

    if (expectsMiddleware.expected) {
      findings.push({
        id: generateFindingId(route),
        severity: "high",
        confidence: 0.7,
        category: "hallucinations",
        ruleId: RULE_ID,
        title: `Route ${route.method} ${route.path} expects middleware but is not covered`,
        description: generateDescription(route, middlewareMap[0], expectsMiddleware.reason),
        evidence: [
          {
            file: route.file,
            startLine: route.startLine,
            endLine: route.endLine,
            snippet: `export async function ${route.method}(request: Request)`,
            label: "Route expecting middleware protection",
          },
          ...(expectsMiddleware.evidenceLocation
            ? [
                {
                  file: expectsMiddleware.evidenceLocation.file,
                  startLine: expectsMiddleware.evidenceLocation.line,
                  endLine: expectsMiddleware.evidenceLocation.line,
                  snippet: expectsMiddleware.evidenceSnippet || "",
                  label: "Signal expecting middleware",
                },
              ]
            : []),
          {
            file: middlewareMap[0].file,
            startLine: middlewareMap[0].startLine,
            endLine: middlewareMap[0].startLine,
            snippet: `matcher: ${JSON.stringify(allMatchers)}`,
            label: "Current middleware matcher (does not cover this route)",
          },
        ],
        remediation: {
          recommendedFix: generateRemediation(route, allMatchers),
        },
        fingerprint: generateFingerprint(route),
      });
    }
  }

  return findings;
}

interface ExpectationResult {
  expected: boolean;
  reason: string;
  evidenceLocation?: { file: string; line: number };
  evidenceSnippet?: string;
}

function checkMiddlewareExpectation(
  ctx: ScanContext,
  route: RouteInfo,
  claims: IntentClaim[]
): ExpectationResult {
  // Check intent claims for middleware protection
  const middlewareClaims = claims.filter(
    (c) =>
      c.type === "MIDDLEWARE_PROTECTED" &&
      (c.targetRouteId === route.routeId || c.scope === "global" || c.location.file === route.file)
  );

  if (middlewareClaims.length > 0) {
    const claim = middlewareClaims[0];
    return {
      expected: true,
      reason: "Intent claim indicates middleware protection expected",
      evidenceLocation: {
        file: claim.location.file,
        line: claim.location.startLine,
      },
      evidenceSnippet: claim.textEvidence,
    };
  }

  // Check source file for middleware expectation signals
  const sourceFile = ctx.helpers.parseFile(
    require("path").join(ctx.repoRoot, route.file)
  );

  if (sourceFile) {
    const fullText = sourceFile.getFullText();

    for (const signal of MIDDLEWARE_EXPECTATION_SIGNALS) {
      const match = fullText.match(signal);
      if (match) {
        const pos = match.index || 0;
        const line = sourceFile.getLineAndColumnAtPos(pos).line;

        return {
          expected: true,
          reason: "Code pattern suggests middleware protection expected",
          evidenceLocation: {
            file: route.file,
            line,
          },
          evidenceSnippet: match[0],
        };
      }
    }
  }

  // Check if auth claims exist but no auth check in handler
  const authClaims = claims.filter(
    (c) =>
      c.type === "AUTH_ENFORCED" &&
      c.source === "comment" &&
      (c.targetRouteId === route.routeId || c.location.file === route.file)
  );

  if (authClaims.length > 0) {
    // Check if the handler has its own auth check
    const handlers = ctx.helpers.findRouteHandlers(sourceFile!);
    const handler = handlers.find((h) => h.method === route.method);

    if (handler && !ctx.helpers.containsAuthCheck(handler.functionNode)) {
      // Auth is claimed but not in handler - might expect middleware
      const claim = authClaims[0];
      return {
        expected: true,
        reason: "Auth claimed in comment but not in handler - may expect middleware",
        evidenceLocation: {
          file: claim.location.file,
          line: claim.location.startLine,
        },
        evidenceSnippet: claim.textEvidence,
      };
    }
  }

  return { expected: false, reason: "" };
}

function generateDescription(
  route: RouteInfo,
  middleware: { file: string; matchers: string[] },
  reason: string
): string {
  return (
    `The route ${route.method} ${route.path} shows signals that it expects middleware protection, ` +
    `but the middleware matcher in ${middleware.file} does not cover this path. ` +
    `${reason}. This could leave the route unprotected.`
  );
}

function generateRemediation(route: RouteInfo, currentMatchers: string[]): string {
  const suggestedPattern = route.path.includes("/api/")
    ? "/api/:path*"
    : `${route.path}/:path*`;

  return (
    `Update the middleware matcher to include this route. ` +
    `Current matchers: ${JSON.stringify(currentMatchers)}. ` +
    `Consider adding "${suggestedPattern}" or add explicit auth in the handler.`
  );
}

function generateFindingId(route: RouteInfo): string {
  return `f-${crypto.randomUUID().slice(0, 8)}`;
}

function generateFingerprint(route: RouteInfo): string {
  const data = `${RULE_ID}:${route.file}:${route.method}:${route.path}`;
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

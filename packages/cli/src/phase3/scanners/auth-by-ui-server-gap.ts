/**
 * VC-AUTH-010: Auth-by-UI with Server Gap
 *
 * Detects patterns where authentication appears to be enforced only
 * on the client side (via useSession, conditionally rendering UI, etc.)
 * but the corresponding API routes lack server-side auth checks.
 *
 * Severity: Critical
 * Category: auth
 * Confidence: 0.85
 */

import crypto from "node:crypto";
import path from "node:path";
import { SyntaxKind } from "ts-morph";
import type { Finding } from "@vibecheck/schema";
import type { ScanContext, RouteInfo } from "../../scanners/types.js";
import { buildRouteMap, buildAllProofTraces } from "../proof-trace-builder.js";

const RULE_ID = "VC-AUTH-010";

/**
 * Client-side auth patterns that suggest UI-level protection
 */
const CLIENT_AUTH_PATTERNS = [
  // React/Next.js session hooks
  /\buseSession\s*\(/,
  /\buseAuth\s*\(/,
  /\buseUser\s*\(/,
  /\bsession\s*&&/,
  /\bsession\s*\?/,
  /\bisAuthenticated\s*&&/,
  /\bisLoggedIn\s*&&/,

  // Conditional rendering based on auth
  /{\s*session\s*&&/,
  /{\s*user\s*&&/,
  /{\s*isAuthenticated\s*&&/,

  // Auth redirects in client components
  /redirect\([^)]*login/i,
  /router\.push\([^)]*login/i,
  /useRouter.*login/i,
];

/**
 * Patterns indicating the component makes API calls
 */
const API_CALL_PATTERNS = [
  // Fetch to API routes
  /fetch\s*\(\s*['"`]\/api\//,
  /fetch\s*\(\s*['"`]\.\.?\/api\//,

  // Axios to API routes
  /axios\.[a-z]+\s*\(\s*['"`]\/api\//,

  // Form actions
  /action\s*=\s*['"`]\/api\//,

  // SWR/React Query to API routes
  /useSWR\s*\(\s*['"`]\/api\//,
  /useQuery\s*\([^)]*['"`]\/api\//,
];

export async function scanAuthByUiServerGap(
  ctx: ScanContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Build route map and proof traces
  const routes = buildRouteMap(ctx);
  const proofTraces = buildAllProofTraces(ctx, routes);

  // Find state-changing routes without auth
  const unprotectedRoutes = routes.filter((r) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(r.method)) {
      return false;
    }
    const trace = proofTraces.get(r.routeId);
    return trace && !trace.authProven && !trace.middlewareCovered;
  });

  if (unprotectedRoutes.length === 0) {
    return findings;
  }

  // Scan client components for UI-level auth patterns
  const clientComponents = ctx.fileIndex.allSourceFiles.filter(
    (f) =>
      (f.endsWith(".tsx") || f.endsWith(".jsx")) &&
      !f.includes("/api/") &&
      !f.includes("route.")
  );

  for (const componentFile of clientComponents) {
    const sourceFile = ctx.helpers.parseFile(componentFile);
    if (!sourceFile) continue;

    const fullText = sourceFile.getFullText();
    const relPath = path.relative(ctx.repoRoot, componentFile).replace(/\\/g, "/");

    // Check for client-side auth patterns
    const hasClientAuth = CLIENT_AUTH_PATTERNS.some((p) => p.test(fullText));
    if (!hasClientAuth) continue;

    // Find API calls in this component
    const apiCalls = findApiCalls(fullText, relPath, sourceFile);
    if (apiCalls.length === 0) continue;

    // Check if any API calls target unprotected routes
    for (const apiCall of apiCalls) {
      const matchingUnprotected = findMatchingUnprotectedRoute(
        apiCall.path,
        apiCall.method,
        unprotectedRoutes
      );

      if (matchingUnprotected) {
        const clientAuthLocation = findClientAuthLocation(sourceFile, fullText);

        findings.push({
          id: `f-${crypto.randomUUID().slice(0, 8)}`,
          severity: "critical",
          confidence: 0.85,
          category: "auth",
          ruleId: RULE_ID,
          title: `Client-side auth with unprotected server endpoint ${matchingUnprotected.method} ${matchingUnprotected.path}`,
          description: generateDescription(
            relPath,
            matchingUnprotected,
            apiCall
          ),
          evidence: [
            {
              file: relPath,
              startLine: clientAuthLocation.line,
              endLine: clientAuthLocation.line,
              snippet: clientAuthLocation.snippet,
              label: "Client-side auth check",
            },
            {
              file: relPath,
              startLine: apiCall.line,
              endLine: apiCall.line,
              snippet: apiCall.snippet,
              label: "API call to unprotected endpoint",
            },
            {
              file: matchingUnprotected.file,
              startLine: matchingUnprotected.startLine,
              endLine: matchingUnprotected.endLine,
              snippet: `export async function ${matchingUnprotected.method}(request: Request)`,
              label: "Server endpoint without auth check",
            },
          ],
          remediation: {
            recommendedFix: generateRemediation(matchingUnprotected),
          },
          fingerprint: generateFingerprint(relPath, matchingUnprotected),
        });
      }
    }
  }

  return findings;
}

interface ApiCall {
  path: string;
  method: string;
  line: number;
  snippet: string;
}

function findApiCalls(
  fullText: string,
  relPath: string,
  sourceFile: any
): ApiCall[] {
  const calls: ApiCall[] = [];

  // Find fetch calls to /api routes
  const fetchMatches = fullText.matchAll(
    /fetch\s*\(\s*['"`](\/api\/[^'"`]+)['"`](?:,\s*\{[^}]*method:\s*['"`](\w+)['"`])?/g
  );

  for (const match of fetchMatches) {
    const pos = match.index || 0;
    const line = sourceFile.getLineAndColumnAtPos(pos).line;
    calls.push({
      path: match[1],
      method: match[2]?.toUpperCase() || "GET",
      line,
      snippet: match[0].slice(0, 80),
    });
  }

  // Find axios calls
  const axiosMatches = fullText.matchAll(
    /axios\.(\w+)\s*\(\s*['"`](\/api\/[^'"`]+)['"`]/g
  );

  for (const match of axiosMatches) {
    const pos = match.index || 0;
    const line = sourceFile.getLineAndColumnAtPos(pos).line;
    calls.push({
      path: match[2],
      method: match[1].toUpperCase(),
      line,
      snippet: match[0].slice(0, 80),
    });
  }

  // Find form actions
  const actionMatches = fullText.matchAll(
    /action\s*=\s*['"`](\/api\/[^'"`]+)['"`]/g
  );

  for (const match of actionMatches) {
    const pos = match.index || 0;
    const line = sourceFile.getLineAndColumnAtPos(pos).line;
    calls.push({
      path: match[1],
      method: "POST", // Form actions are typically POST
      line,
      snippet: match[0],
    });
  }

  return calls;
}

function findMatchingUnprotectedRoute(
  apiPath: string,
  method: string,
  unprotectedRoutes: RouteInfo[]
): RouteInfo | undefined {
  // Normalize the API path
  const normalizedPath = apiPath.split("?")[0]; // Remove query string

  for (const route of unprotectedRoutes) {
    // Check method match
    if (route.method !== method) continue;

    // Check path match (accounting for dynamic segments)
    if (pathsMatch(normalizedPath, route.path)) {
      return route;
    }
  }

  return undefined;
}

function pathsMatch(clientPath: string, routePath: string): boolean {
  // Exact match
  if (clientPath === routePath) return true;

  // Convert route path pattern to regex
  const routePattern = routePath
    .replace(/\[([^\]]+)\]/g, "[^/]+") // Replace [param] with regex
    .replace(/\//g, "\\/"); // Escape slashes

  try {
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(clientPath);
  } catch {
    return false;
  }
}

function findClientAuthLocation(
  sourceFile: any,
  fullText: string
): { line: number; snippet: string } {
  // Find the first client auth pattern
  for (const pattern of CLIENT_AUTH_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      const pos = match.index || 0;
      const line = sourceFile.getLineAndColumnAtPos(pos).line;
      return {
        line,
        snippet: match[0],
      };
    }
  }

  return { line: 1, snippet: "Client-side auth" };
}

function generateDescription(
  componentFile: string,
  route: RouteInfo,
  apiCall: ApiCall
): string {
  return (
    `The component ${componentFile} uses client-side authentication checks ` +
    `(useSession, session &&, etc.) before calling the API endpoint ` +
    `${route.method} ${route.path}. However, this endpoint lacks server-side ` +
    `authentication verification. An attacker can bypass the UI and directly ` +
    `call the API endpoint without authentication, potentially gaining ` +
    `unauthorized access to sensitive operations.`
  );
}

function generateRemediation(route: RouteInfo): string {
  return (
    `Add server-side authentication check to the ${route.method} ${route.path} handler. ` +
    `Example:\n` +
    `const session = await getServerSession();\n` +
    `if (!session) {\n` +
    `  return Response.json({ error: "Unauthorized" }, { status: 401 });\n` +
    `}\n\n` +
    `Client-side auth checks are for UX only and must never be the sole protection mechanism.`
  );
}

function generateFingerprint(componentFile: string, route: RouteInfo): string {
  const data = `${RULE_ID}:${componentFile}:${route.file}:${route.method}`;
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}
